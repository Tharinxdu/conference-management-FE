// FILE: src/admin/check-in/check-in.ts
// Requires: yarn add @zxing/browser
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
import { CheckInService } from "../../services/check-in.service";
import type {
  PreviewByRegistrationIdResponse,
  PreviewQrResponse,
  CheckInStatus,
  QrLifecycleStatus,
} from "./check-in.types";

// ✅ IMPORTANT: use the SAME import path/name you already use in AdminAbstract for <app-page-shell>
import { PageShell } from "../../page-shell/page-shell";

import { BrowserMultiFormatReader } from "@zxing/browser";

type TabKey = "qr" | "id";

type UnifiedPreview = {
  source: "qr" | "id";
  attendee: {
    registrationId: string;
    firstName?: string;
    lastName?: string;
    conferenceType?: string;
    email?: string;
  };
  qr: {
    status?: QrLifecycleStatus; // only for qr scans
    checkInStatus: CheckInStatus;
    checkedInAt?: string | null;
    checkedInBy?: string | null;
  };
  paymentStatus?: "UNPAID" | "PENDING" | "PAID" | "FAILED"; // only for reg-id preview
};

@Component({
  selector: "app-check-in",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, PageShell],
  templateUrl: "./check-in.html",
  styleUrl: "./check-in.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckIn {
  private readonly api = inject(CheckInService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild("videoEl", { static: false })
  videoEl?: ElementRef<HTMLVideoElement>;

  // UI
  readonly tab = signal<TabKey>("qr");
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly infoMsg = signal<string | null>(null);

  // Scanner
  readonly cameraOpen = signal(false);
  readonly cameraBusy = signal(false);
  readonly devices = signal<Array<{ deviceId: string; label: string }>>([]);
  readonly selectedDeviceId = signal<string>("");

  private reader: BrowserMultiFormatReader | null = null;
  private scanControls: { stop: () => void } | null = null;
  private scanLock = false;

  // Forms
  readonly qrForm = new FormGroup({
    qrText: new FormControl<string>("", { nonNullable: true, validators: [Validators.required] }),
  });

  readonly idForm = new FormGroup({
    registrationId: new FormControl<string>("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  });

  // Preview modal state
  readonly modalOpen = signal(false);
  readonly preview = signal<UnifiedPreview | null>(null);
  private lastQrText = "";
  private lastRegistrationId = "";

  readonly canConfirm = computed(() => {
    const p = this.preview();
    if (!p) return false;
    if (p.source === "id" && p.paymentStatus && p.paymentStatus !== "PAID") return false;
    return p.qr.checkInStatus !== "CHECKED_IN";
  });

  readonly confirmLabel = computed(() => {
    const p = this.preview();
    if (!p) return "Confirm Check-in";
    if (p.qr.checkInStatus === "CHECKED_IN") return "Already checked in";
    if (p.source === "id" && p.paymentStatus && p.paymentStatus !== "PAID") return "Payment not PAID";
    return "Confirm Check-in";
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

  // ---------- Tabs ----------
  setTab(next: TabKey) {
    if (this.tab() === next) return;
    this.clearBanners();
    this.modalOpen.set(false);
    this.preview.set(null);
    this.tab.set(next);
  }

  // ---------- Scanner ----------
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
      this.errorMsg.set("Could not access camera. Allow camera permission, or use Registration ID.");
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
          this.errorMsg.set("Scanner error. Try changing camera or use Registration ID.");
        }
      });
    } catch {
      this.errorMsg.set("Could not start scanner. Try changing camera or use Registration ID.");
      this.cameraOpen.set(false);
    }
  }

  private stopCamera(clearVideo = true) {
    try {
      this.scanControls?.stop();
    } catch { }
    this.scanControls = null;

    if (clearVideo && this.videoEl?.nativeElement) {
      const v = this.videoEl.nativeElement;
      const stream = v.srcObject as MediaStream | null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      try {
        v.pause();
      } catch { }
      v.srcObject = null;
    }
  }

  // ---------- API (Preview / Confirm) ----------
  previewQr(qrText: string) {
    this.clearBanners();
    this.loading.set(true);
    this.lastQrText = qrText;

    this.api
      .previewQr(qrText)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res: PreviewQrResponse) => {
          this.preview.set({
            source: "qr",
            attendee: {
              registrationId: res.attendee.registrationId,
              firstName: res.attendee.firstName,
              lastName: res.attendee.lastName,
              conferenceType: res.attendee.conferenceType,
              email: res.attendee.email,
            },
            qr: {
              status: res.qr.status,
              checkInStatus: res.qr.checkInStatus,
              checkedInAt: res.qr.checkedInAt ?? null,
              checkedInBy: res.qr.checkedInBy ?? null,
            },
          });
          this.modalOpen.set(true);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  confirmQr() {
    const p = this.preview();
    if (!p || p.source !== "qr") return;

    const qrText = this.lastQrText;
    if (!qrText) return;

    this.clearBanners();
    this.loading.set(true);

    this.api
      .confirmQr(qrText)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.infoMsg.set(res.message || "Checked in");

          // ✅ Close popup after success so it doesn't show "Already checked in"
          this.modalOpen.set(false);
          this.preview.set(null);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  previewById() {
    this.clearBanners();
    const registrationId = (this.idForm.controls.registrationId.value || "").trim().toUpperCase();
    if (!registrationId) return;

    this.loading.set(true);
    this.lastRegistrationId = registrationId;

    this.api
      .previewByRegistrationId(registrationId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res: PreviewByRegistrationIdResponse) => {
          this.preview.set({
            source: "id",
            attendee: {
              registrationId: res.registrationId,
              firstName: res.attendee?.firstName,
              lastName: res.attendee?.lastName,
              conferenceType: res.attendee?.conferenceType,
            },
            paymentStatus: res.paymentStatus,
            qr: {
              checkInStatus: res.checkInStatus,
              checkedInAt: res.checkedInAt ?? null,
            },
          });
          this.modalOpen.set(true);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  confirmById() {
    const p = this.preview();
    if (!p || p.source !== "id") return;

    const registrationId = this.lastRegistrationId;
    if (!registrationId) return;

    this.clearBanners();
    this.loading.set(true);

    this.api
      .confirmByRegistrationId(registrationId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.infoMsg.set(res.message || "Checked in");

          // ✅ Close popup after success so it doesn't show "Already checked in"
          this.modalOpen.set(false);
          this.preview.set(null);
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  // ---------- Modal ----------
  closeModal() {
    this.modalOpen.set(false);
  }

  clearAll() {
    this.clearBanners();
    this.preview.set(null);
    this.modalOpen.set(false);
    this.qrForm.reset({ qrText: "" });
    this.idForm.reset({ registrationId: "" });
    this.lastQrText = "";
    this.lastRegistrationId = "";
  }

  // ---------- Helpers ----------
  chipClassByStatus(status?: string) {
    const s = (status || "").toUpperCase();
    if (s === "CHECKED_IN") return "chip accent";
    return "chip";
  }

  lifecycleChipClass(status?: QrLifecycleStatus) {
    const s = (status || "").toUpperCase();
    if (s === "ACTIVE") return "chip accent";
    return "chip";
  }

  private clearBanners() {
    this.errorMsg.set(null);
    this.infoMsg.set(null);
  }

  private extractError(err: any): string {
    const msg =
      err?.error?.message ||
      err?.error?.error ||
      err?.message ||
      "Something went wrong. Please try again.";
    return String(msg);
  }
}
