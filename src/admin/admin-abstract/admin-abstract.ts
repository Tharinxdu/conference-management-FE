// FILE: src/app/admin/admin-abstract/admin-abstract.ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormBuilder } from "@angular/forms";
import { BehaviorSubject, combineLatest, of } from "rxjs";
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from "rxjs/operators";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { AdminAbstractsService } from "../../services/admin-abstracts.service";
import {
  AdminAbstractDTO,
  AdminAbstractFilters,
  AdminAbstractListResponse,
  AdminAbstractStatus,
  extractId,
  extractOwnerEmail,
  extractProfileName,
  formatStatusLabel,
  isValidStatus,
  statusChipClass,
} from "./admin-abstract.types";

import { AbstractsService } from "../../services/abstracts.service";

// ASSUMPTION: Existing standalone PageShell + AbstractFormModal paths.
import { PageShell } from "../../page-shell/page-shell";
import { AbstractFormModal } from "../../abstract/abstract-form-modal/abstract-form-modal";

type UiRow = AdminAbstractDTO & {
  __id: string;
  __ownerEmail: string;
  __presenterName: string;
  __attachmentsCount: number;
};

@Component({
  selector: "app-admin-abstract",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageShell, AbstractFormModal],
  templateUrl: "./admin-abstract.html",
  styleUrls: ["./admin-abstract.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    AdminAbstractsService,
    // ✅ Makes AbstractFormModal use admin endpoints *inside this component tree*.
    { provide: AbstractsService, useExisting: AdminAbstractsService },
  ],
})
export class AdminAbstract {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly adminSvc = inject(AdminAbstractsService);

  openStatusMenuId: string | null = null;

  readonly statusOptions: Array<{ label: string; value: "" | AdminAbstractStatus }> = [
    { label: "All statuses", value: "" },
    { label: "Submitted", value: "submitted" },
    { label: "Under review", value: "under-review" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  readonly rowStatusOptions: Array<{ label: string; value: AdminAbstractStatus }> = [
    { label: "Submitted", value: "submitted" },
    { label: "Under review", value: "under-review" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  readonly pageSizeOptions = [25, 50, 100];

  readonly form = this.fb.group({
    search: this.fb.control<string>(""),
    status: this.fb.control<"" | AdminAbstractStatus>(""),
    ownerId: this.fb.control<string>(""),
  });

  moreFiltersOpen = false;

  private readonly filters$ = new BehaviorSubject<AdminAbstractFilters>({
    search: "",
    status: "",
    ownerId: "",
  });
  private readonly page$ = new BehaviorSubject<number>(1);
  private readonly limit$ = new BehaviorSubject<number>(25);
  private readonly refresh$ = new BehaviorSubject<number>(0);

  readonly pageLoading$ = new BehaviorSubject<boolean>(false);
  readonly exportBusy$ = new BehaviorSubject<boolean>(false);
  readonly errorMsg$ = new BehaviorSubject<string | null>(null);
  readonly infoMsg$ = new BehaviorSubject<string | null>(null);

  readonly rowDeletingIds = new Set<string>();
  readonly rowStatusUpdatingIds = new Set<string>();

  private readonly statusPatch = new Map<string, AdminAbstractStatus>();

  // modal state
  modalOpen = false;
  modalMode: "view" | "edit" | "create" = "view";
  modalId: string | undefined = undefined;
  modalInitialData: any | undefined = undefined;

  // confirm delete modal
  confirmOpen = false;
  confirmTargetId: string | undefined = undefined;
  confirmTargetTitle: string | undefined = undefined;

  @ViewChild("confirmDialog") confirmDialog?: ElementRef<HTMLDivElement>;
  @ViewChild("confirmCancelBtn") confirmCancelBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild("confirmDeleteBtn") confirmDeleteBtn?: ElementRef<HTMLButtonElement>;

  readonly vm$ = combineLatest([
    this.filters$,
    this.page$,
    this.limit$,
    this.refresh$.pipe(startWith(0)),
  ]).pipe(
    tap(() => {
      this.errorMsg$.next(null);
      this.pageLoading$.next(true);
    }),
    switchMap(([filters, page, limit]) =>
      this.adminSvc.listAbstracts(filters, page, limit).pipe(
        catchError((err) => {
          const msg =
            err?.error?.message || err?.message || "Could not load abstracts. Please try again.";
          this.errorMsg$.next(msg);
          const empty: AdminAbstractListResponse = { items: [], total: 0, page, limit };
          return of(empty);
        }),
        finalize(() => this.pageLoading$.next(false))
      )
    ),
    map((res) => {
      const items: UiRow[] = (res.items || []).map((d) => {
        const id = extractId((d as any)._id || (d as any).id || "");
        const ownerEmail = extractOwnerEmail((d as any).owner);
        const presenter = String(
          (d as any).presentingAuthorName ||
            extractProfileName((d as any).presentingAuthorProfile) ||
            ""
        ).trim();
        const attachmentsCount = Array.isArray((d as any).attachments)
          ? (d as any).attachments.length
          : 0;

        return {
          ...(d as any),
          __id: id,
          __ownerEmail: ownerEmail,
          __presenterName: presenter,
          __attachmentsCount: attachmentsCount,
        };
      });

      for (const row of items) {
        const patched = this.statusPatch.get(row.__id);
        if (patched && String((row as any).status) === patched) {
          this.statusPatch.delete(row.__id);
        }
      }

      const total = Number((res as any).total || 0);
      const page = Number((res as any).page || 1);
      const limit = Number((res as any).limit || 25);
      const from = total === 0 ? 0 : (page - 1) * limit + 1;
      const to = Math.min(page * limit, total);
      const pages = Math.max(1, Math.ceil(total / limit));

      return { items, total, page, limit, from, to, pages, empty: items.length === 0 };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
    this.form.controls.search.valueChanges
      .pipe(
        startWith(this.form.controls.search.value),
        debounceTime(300),
        map((v) => (v ?? "").trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((search) => {
        const curr = this.filters$.value;
        this.filters$.next({ ...curr, search });
        this.page$.next(1);
        this.refresh();
      });

    this.form.controls.status.valueChanges
      .pipe(
        startWith(this.form.controls.status.value),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((status) => {
        const curr = this.filters$.value;
        this.filters$.next({ ...curr, status: status || "" });
        this.page$.next(1);
        this.refresh();
      });

    this.form.controls.ownerId.valueChanges
      .pipe(
        startWith(this.form.controls.ownerId.value),
        debounceTime(250),
        map((v) => (v ?? "").trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((ownerId) => {
        const curr = this.filters$.value;
        this.filters$.next({ ...curr, ownerId });
        this.page$.next(1);
        this.refresh();
      });
  }

  refresh(): void {
    this.refresh$.next(this.refresh$.value + 1);
  }

  clearFilters(): void {
    this.form.setValue({ search: "", status: "", ownerId: "" }, { emitEvent: true });
    this.moreFiltersOpen = false;
    this.page$.next(1);
    this.refresh();
  }

  setPageSize(limit: number | string): void {
    const n = Number(limit || 25);
    const next = this.pageSizeOptions.includes(n) ? n : 25;
    this.limit$.next(next);
    this.page$.next(1);
    this.refresh();
  }

  goFirst(vm: any): void {
    if (!vm || vm.page <= 1) return;
    this.page$.next(1);
    this.refresh();
  }

  goPrev(vm: any): void {
    if (!vm || vm.page <= 1) return;
    this.page$.next(vm.page - 1);
    this.refresh();
  }

  goNext(vm: any): void {
    if (!vm || vm.page >= vm.pages) return;
    this.page$.next(vm.page + 1);
    this.refresh();
  }

  goLast(vm: any): void {
    if (!vm || vm.page >= vm.pages) return;
    this.page$.next(vm.pages);
    this.refresh();
  }

  openView(row: UiRow): void {
    this.modalOpen = true;
    this.modalMode = "view";
    this.modalId = row.__id;
    this.modalInitialData = row;
    this.infoMsg$.next(null);
    this.errorMsg$.next(null);
  }

  openEdit(row: UiRow): void {
    this.modalOpen = true;
    this.modalMode = "edit";
    this.modalId = row.__id;
    this.modalInitialData = row;
    this.infoMsg$.next("Editing content will reset status to Submitted.");
    this.errorMsg$.next(null);
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalId = undefined;
    this.modalInitialData = undefined;
  }

  onModalClosed(): void {
    this.closeModal();
  }

  onModalSaved(): void {
    this.closeModal();
    this.infoMsg$.next("Saved. Status was reset to Submitted.");
    this.refresh();
  }

  formatStatus(status: any): string {
    return formatStatusLabel(status);
  }

  chipClass(status: any): string {
    return statusChipClass(status);
  }

  effectiveStatus(row: UiRow): string {
    const patched = this.statusPatch.get(row.__id);
    return patched || String((row as any).status || "");
  }

  canUpdateStatus(rowId: string): boolean {
    return !this.rowStatusUpdatingIds.has(rowId);
  }

  onRowStatusChange(row: UiRow, raw: any, ev?: Event): void {
    if (ev) ev.stopPropagation();

    const id = row.__id;
    const next = String(raw || "").trim();

    if (!isValidStatus(next)) {
      this.errorMsg$.next("Invalid status value.");
      return;
    }

    const prevServer = isValidStatus((row as any).status)
      ? ((row as any).status as AdminAbstractStatus)
      : "submitted";
    const prev = this.statusPatch.get(id) || prevServer;

    if (prev === next) return;

    this.statusPatch.set(id, next);
    this.rowStatusUpdatingIds.add(id);
    this.errorMsg$.next(null);

    this.adminSvc
      .updateStatus(id, next)
      .pipe(
        finalize(() => this.rowStatusUpdatingIds.delete(id)),
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          const msg =
            err?.error?.message || err?.message || "Could not update status. Please try again.";
          this.errorMsg$.next(msg);
          this.statusPatch.set(id, prev);
          return of(null);
        })
      )
      .subscribe((updated) => {
        if (!updated) return;
        if (isValidStatus((updated as any).status)) {
          this.statusPatch.set(id, (updated as any).status);
        }
        this.infoMsg$.next("Status updated.");
      });
  }

  askDelete(row: UiRow, ev?: Event): void {
    if (ev) ev.stopPropagation();

    this.confirmOpen = true;
    this.confirmTargetId = row.__id;
    this.confirmTargetTitle = String((row as any).abstractTitle || "this abstract");
    this.errorMsg$.next(null);
    this.infoMsg$.next(null);

    queueMicrotask(() => {
      setTimeout(() => this.confirmCancelBtn?.nativeElement?.focus(), 0);
    });
  }

  cancelDelete(): void {
    this.confirmOpen = false;
    this.confirmTargetId = undefined;
    this.confirmTargetTitle = undefined;
  }

  confirmDelete(): void {
    const id = this.confirmTargetId;
    if (!id) return;
    if (this.rowDeletingIds.has(id)) return;

    this.rowDeletingIds.add(id);
    this.errorMsg$.next(null);

    this.adminSvc
      .deleteAbstract(id)
      .pipe(
        finalize(() => this.rowDeletingIds.delete(id)),
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          const msg =
            err?.error?.message || err?.message || "Could not delete abstract. Please try again.";
          this.errorMsg$.next(msg);
          return of(null);
        })
      )
      .subscribe((res) => {
        if (!res) return;
        this.cancelDelete();
        this.infoMsg$.next("Abstract deleted.");
        this.refresh();
      });
  }

  isDeleting(id: string): boolean {
    return this.rowDeletingIds.has(id);
  }

  isStatusUpdating(id: string): boolean {
    return this.rowStatusUpdatingIds.has(id);
  }

  /**
   * ✅ EXPORT (EXCEL)
   * Always exports ALL abstracts that match current filters (not just the current page),
   * using the backend endpoint: GET /api/admin/abstracts/export/excel
   */
  exportAll(vm?: any): void {
    if (this.exportBusy$.value) return;

    this.exportBusy$.next(true);
    this.errorMsg$.next(null);
    this.infoMsg$.next(null);

    const filters = this.filters$.value;

    this.adminSvc
      .exportExcel(filters)
      .pipe(
        finalize(() => this.exportBusy$.next(false)),
        catchError((err) => {
          const msg = err?.error?.message || err?.message || "Export failed. Please try again.";
          this.errorMsg$.next(msg);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((blob) => {
        if (!blob) return;
        this.downloadBlob(blob, "abstracts.xlsx");
        this.infoMsg$.next("Export completed.");
      });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  @HostListener("document:keydown.escape")
  onEsc(): void {
    if (this.confirmOpen) this.cancelDelete();
    if (this.modalOpen) this.closeModal();
  }

  onRowKeydown(ev: KeyboardEvent, row: UiRow): void {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      this.openView(row);
    }
  }

  toggleStatusMenu(id: string) {
    this.openStatusMenuId = this.openStatusMenuId === id ? null : id;
  }

  closeStatusMenu() {
    this.openStatusMenuId = null;
  }

  // minimal focus trap for confirm dialog
  @HostListener("document:keydown", ["$event"])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.confirmOpen) return;
    if (ev.key !== "Tab") return;

    const root = this.confirmDialog?.nativeElement;
    if (!root) return;

    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));

    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (ev.shiftKey) {
      if (!active || active === first) {
        ev.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  }
}
