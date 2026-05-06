import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { finalize } from "rxjs/operators";
import { BrowserMultiFormatReader } from "@zxing/browser";

import { PageShell } from "../../page-shell/page-shell";
import { GalaRedeemService } from "../../services/gala-redeem.service";
import { GalaPreview } from "./gala-check-in.types";

type TabKey = "qr" | "id";

@Component({
  selector: "app-gala-check-in",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, PageShell],
  templateUrl: "./gala-check-in.html",
  styleUrl: "./gala-check-in.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalaCheckIn {
  private readonly api = inject(GalaRedeemService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild("videoEl", { static: false }) videoEl?: ElementRef<HTMLVideoElement>;

  readonly tab = signal<TabKey>("qr");
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly infoMsg = signal<string | null>(null);

  readonly cameraOpen = signal(false);
  readonly cameraBusy = signal(false);
  readonly devices = signal<Array<{ deviceId: string; label: string }>>([]);
  readonly selectedDeviceId = signal<string>("");

  private reader: BrowserMultiFormatReader | null = null;
  private scanControls: { stop: () => void } | null = null;
  private scanLock = false;

  readonly qrForm = new FormGroup({
    qrText: new FormControl<string>("", { nonNullable: true, validators: [Validators.required] }),
  });

  readonly idForm = new FormGroup({
    ticketId: new FormControl<string>("", { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  readonly modalOpen = signal(false);
  readonly preview = signal<GalaPreview | null>(null);

  private lastQrText = "";
  private lastTicketId = "";
  private lastSource: "qr" | "id" = "qr";

  readonly canConfirm = computed(() => {
    const p = this.preview();
    if (!p) return false;
    return p.ticket.redeemStatus !== "REDEEMED";
  });

  readonly confirmLabel = computed(() => {
    const p = this.preview();
    if (!p) return "Confirm redeem";
    if (p.ticket.redeemStatus === "REDEEMED") return "Already redeemed";
    return "Confirm redeem";
  });

  constructor() {
    effect(() => {
      if (!this.cameraOpen()) this.stopCamera();
    });

    this.destroyRef.onDestroy(() => {
      this.stopCamera();
      this.reader = null;
    });
  }

  previewSource() {
    return this.lastSource;
  }

  setTab(next: TabKey) {
    if (this.tab() === next) return;
    this.clearBanners();
    this.modalOpen.set(false);
    this.preview.set(null);
    this.tab.set(next);
  }

  async toggleCamera() {
    if (this.cameraOpen()) {
      this.cameraOpen.set(false);
      return;
    }
    await this.openCamera();
  }

  async openCamera() {
    this.clearBanners();
    this.cameraBusy.set(true);

    try {
      if (!this.reader) this.reader = new BrowserMultiFormatReader();

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const mapped = devices.map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || (idx === 0 ? "Camera" : `Camera ${idx + 1}`),
      }));

      this.devices.set(mapped);

      const preferred =
        mapped.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
        mapped[0]?.deviceId ||
        "";

      this.selectedDeviceId.set(preferred);

      this.cameraOpen.set(true);
      queueMicrotask(() => void this.startDecoding());
    } catch {
      this.errorMsg.set("Could not access camera. Allow permission or use Ticket ID.");
      this.cameraOpen.set(false);
    } finally {
      this.cameraBusy.set(false);
    }
  }

  async onDeviceChange(deviceId: string) {
    this.selectedDeviceId.set(deviceId);
    if (this.cameraOpen()) {
      this.stopCamera(false);
      this.cameraOpen.set(true);
      queueMicrotask(() => void this.startDecoding());
    }
  }

  private isNotFoundErr(err: unknown): boolean {
    const name = String((err as any)?.name || "");
    const msg = String((err as any)?.message || "");
    const joined = (name + " " + msg).toLowerCase();
    return joined.includes("notfound") || joined.includes("not found") || joined.includes("no code");
  }

  private async startDecoding() {
    if (!this.cameraOpen()) return;
    if (!this.videoEl?.nativeElement) return;
    if (!this.reader) this.reader = new BrowserMultiFormatReader();

    this.scanLock = false;
    this.stopCamera(false);

    const deviceId = this.selectedDeviceId() || undefined;
    const video = this.videoEl.nativeElement;

    try {
      this.scanControls = await this.reader.decodeFromVideoDevice(deviceId, video, (result, err) => {
        if (!this.cameraOpen()) return;

        if (result?.getText && !this.scanLock) {
          const text = (result.getText() || "").trim();
          if (!text) return;

          this.scanLock = true;
          this.cameraOpen.set(false);

          this.qrForm.controls.qrText.setValue(text);
          this.previewQr(text);
          return;
        }

        if (err && !this.isNotFoundErr(err)) {
          this.errorMsg.set("Scanner error. Try changing camera or use Ticket ID.");
        }
      });
    } catch {
      this.errorMsg.set("Could not start scanner. Try changing camera or use Ticket ID.");
      this.cameraOpen.set(false);
    }
  }

  private stopCamera(clearVideo = true) {
    try {
      this.scanControls?.stop();
    } catch {}
    this.scanControls = null;

    if (clearVideo && this.videoEl?.nativeElement) {
      const v = this.videoEl.nativeElement;
      const stream = v.srcObject as MediaStream | null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      try { v.pause(); } catch {}
      v.srcObject = null;
    }
  }

  previewQr(qrText: string) {
    this.clearBanners();
    this.loading.set(true);
    this.lastQrText = qrText;
    this.lastSource = "qr";

    this.api
      .previewQr(qrText)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.preview.set(res);
          this.modalOpen.set(true);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  confirmQr() {
    const qrText = this.lastQrText;
    if (!qrText) return;

    this.clearBanners();
    this.loading.set(true);

    this.api
      .confirmQr(qrText)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.infoMsg.set(res.message || "Redeemed");
          this.modalOpen.set(false);
          this.preview.set(null);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  previewById() {
    this.clearBanners();
    const ticketId = (this.idForm.controls.ticketId.value || "").trim().toUpperCase();
    if (!ticketId) return;

    this.loading.set(true);
    this.lastTicketId = ticketId;
    this.lastSource = "id";

    this.api
      .previewByTicketId(ticketId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.preview.set(res);
          this.modalOpen.set(true);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  confirmById() {
    const ticketId = this.lastTicketId;
    if (!ticketId) return;

    this.clearBanners();
    this.loading.set(true);

    this.api
      .confirmByTicketId(ticketId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.infoMsg.set(res.message || "Redeemed");
          this.modalOpen.set(false);
          this.preview.set(null);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  clearAll() {
    this.clearBanners();
    this.preview.set(null);
    this.modalOpen.set(false);
    this.qrForm.reset({ qrText: "" });
    this.idForm.reset({ ticketId: "" });
    this.lastQrText = "";
    this.lastTicketId = "";
    this.lastSource = "qr";
  }

  private clearBanners() {
    this.errorMsg.set(null);
    this.infoMsg.set(null);
  }

  private extractError(err: any): string {
    return String(err?.error?.message || err?.message || "Something went wrong. Please try again.");
  }
}