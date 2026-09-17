// FILE: src/shared/qr-scanner/qr-scanner.ts
// Requires: @zxing/browser
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader } from '@zxing/browser';

type TVideoDevice = { deviceId: string; label: string };

/**
 * Reusable camera + QR decoder card.
 *
 * Owns the camera lifecycle and emits the decoded text once per scan; the
 * parent decides what a scan *means*. After a successful decode the camera
 * stops so the parent can show a confirmation without the reader firing again —
 * call `start()` to resume for the next person.
 */
@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrScanner {
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('videoEl', { static: false }) videoEl?: ElementRef<HTMLVideoElement>;

  readonly title = input('QR Scanner');
  readonly subtitle = input('Start the camera and hold the QR inside the frame');
  readonly hint = input('Align the QR inside the frame');
  /** CSS colour used for the frame + hint, so different scan modes look different. */
  readonly accentColor = input('rgba(56, 189, 248, 0.9)');

  readonly scanned = output<string>();
  readonly scanError = output<string>();

  readonly cameraOpen = signal(false);
  readonly cameraBusy = signal(false);
  readonly devices = signal<TVideoDevice[]>([]);
  readonly selectedDeviceId = signal<string>('');

  private reader: BrowserMultiFormatReader | null = null;
  private scanControls: { stop: () => void } | null = null;
  /** Guards against the reader firing several times for one physical scan. */
  private scanLock = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stop();
      this.reader = null;
    });
  }

  async toggle(): Promise<void> {
    if (this.cameraOpen()) {
      this.stop();
      return;
    }
    await this.start();
  }

  async start(): Promise<void> {
    if (this.cameraBusy()) return;

    this.cameraBusy.set(true);

    try {
      if (!this.reader) this.reader = new BrowserMultiFormatReader();

      const found = await BrowserMultiFormatReader.listVideoInputDevices();
      const mapped: TVideoDevice[] = found.map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || (idx === 0 ? 'Camera' : `Camera ${idx + 1}`),
      }));

      this.devices.set(mapped);

      // Prefer the rear camera — that's the one pointed at a badge.
      if (!this.selectedDeviceId()) {
        const preferred =
          mapped.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
          mapped[0]?.deviceId ||
          '';
        this.selectedDeviceId.set(preferred);
      }

      this.cameraOpen.set(true);
      queueMicrotask(() => void this.startDecoding());
    } catch {
      this.cameraOpen.set(false);
      this.scanError.emit('Could not access the camera. Allow camera permission, or enter the ID manually.');
    } finally {
      this.cameraBusy.set(false);
    }
  }

  /** Tear down the stream and mark the camera closed. Safe to call repeatedly. */
  stop(): void {
    this.teardownStream();
    this.cameraOpen.set(false);
  }

  async onDeviceChange(deviceId: string): Promise<void> {
    this.selectedDeviceId.set(deviceId);
    if (!this.cameraOpen()) return;

    this.teardownStream(false);
    queueMicrotask(() => void this.startDecoding());
  }

  private async startDecoding(): Promise<void> {
    if (!this.cameraOpen()) return;
    if (!this.videoEl?.nativeElement) return;
    if (!this.reader) this.reader = new BrowserMultiFormatReader();

    this.scanLock = false;
    this.teardownStream(false);

    const deviceId = this.selectedDeviceId() || undefined;
    const video = this.videoEl.nativeElement;

    try {
      this.scanControls = await this.reader.decodeFromVideoDevice(deviceId, video, (result, err) => {
        if (!this.cameraOpen()) return;

        if (result?.getText && !this.scanLock) {
          const text = (result.getText() || '').trim();
          if (!text) return;

          this.scanLock = true;
          this.stop();
          this.scanned.emit(text);
          return;
        }

        // "not found" simply means no QR in this frame — it fires constantly.
        if (err && !this.isNotFoundErr(err)) {
          this.scanError.emit('Scanner error. Try another camera, or enter the ID manually.');
        }
      });
    } catch {
      this.cameraOpen.set(false);
      this.scanError.emit('Could not start the scanner. Try another camera, or enter the ID manually.');
    }
  }

  private teardownStream(clearVideo = true): void {
    try {
      this.scanControls?.stop();
    } catch {
      /* the reader may already be torn down */
    }
    this.scanControls = null;

    if (!clearVideo || !this.videoEl?.nativeElement) return;

    const v = this.videoEl.nativeElement;
    const stream = v.srcObject as MediaStream | null;
    if (stream) stream.getTracks().forEach((t) => t.stop());

    try {
      v.pause();
    } catch {
      /* pausing a detached element can throw */
    }
    v.srcObject = null;
  }

  private isNotFoundErr(err: unknown): boolean {
    const name = String((err as any)?.name || '');
    const msg = String((err as any)?.message || '');
    const joined = `${name} ${msg}`.toLowerCase();
    return joined.includes('notfound') || joined.includes('not found') || joined.includes('no code');
  }
}
