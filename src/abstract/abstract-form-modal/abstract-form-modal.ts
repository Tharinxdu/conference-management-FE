// FILE: src/abstract/abstract-form-modal/abstract-form-modal.ts

import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
  ElementRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  AbstractDTO,
  AbstractMode,
  AttachmentDTO,
  PreferredPresentationType,
  ScientificCategory,
} from '../abstract-form-modal/abstract.types';

import {
  AbstractsService,
  SaveAllInOneUpdates,
} from '../../services/abstracts.service';

import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';

import { Subject, takeUntil } from 'rxjs';

type AbstractFormShape = {
  presentingAuthorName: FormControl<string>;
  correspondingAuthorName: FormControl<string>;
  correspondingAuthorEmail: FormControl<string>;
  abstractTitle: FormControl<string>;
  preferredPresentationTypes: FormControl<PreferredPresentationType[]>;
  scientificCategories: FormControl<ScientificCategory[]>;
  otherCategoryText: FormControl<string>;
  abstractText: FormControl<string>;
  keywords: FormControl<string[]>;
  keywordsInput: FormControl<string>;
  coAuthorsRaw: FormControl<string>;

  decl_originalWork: FormControl<boolean>;
  decl_authorsApproved: FormControl<boolean>;
  decl_agreeProceedings: FormControl<boolean>;
};

@Component({
  selector: 'app-abstract-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './abstract-form-modal.html',
  styleUrl: './abstract-form-modal.scss',
})
export class AbstractFormModal implements OnInit, OnChanges, OnDestroy {
  @Input() open = false;
  @Input() mode: AbstractMode = 'create';
  @Input() abstractId?: string;
  @Input() initialData?: AbstractDTO;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<AbstractDTO>();

  private destroy$ = new Subject<void>();
  private openedOnce = false;
  private destroyed = false;

  form!: FormGroup<AbstractFormShape>;

  loading = false;
  saving = false;
  loadError = '';

  statusLine = '';
  filesError = '';

  loaded: AbstractDTO | null = null;

  existingAttachments: AttachmentDTO[] = [];
  removeAttachmentIds = new Set<string>();
  newFiles: File[] = [];

  abstractWordCount = 0;

  readonly presentationOptions: PreferredPresentationType[] = [
    'ORAL',
    'POSTER',
    'EITHER',
  ];

  readonly scientificCategoryOptions: ScientificCategory[] = [
    'ACUTE_STROKE_MANAGEMENT',
    'STROKE_PREVENTION',
    'NEUROIMAGING_AND_DIAGNOSTICS',
    'REHABILITATION_AND_RECOVERY',
    'BASIC_AND_TRANSLATIONAL_RESEARCH',
    'HEALTH_SYSTEMS_AND_POLICY',
    'OTHER',
  ];

  // ✅ Order used to scroll to the first invalid field on submit
  private readonly fieldOrder: (keyof AbstractFormShape)[] = [
    'presentingAuthorName',
    'correspondingAuthorName',
    'correspondingAuthorEmail',
    'abstractTitle',
    'preferredPresentationTypes',
    'scientificCategories',
    'otherCategoryText',
    'abstractText',
    'keywordsInput',
    'coAuthorsRaw',
    'decl_originalWork',
    'decl_authorsApproved',
    'decl_agreeProceedings',
  ];

  constructor(
    private fb: FormBuilder,
    private abstracts: AbstractsService,
    private cdr: ChangeDetectorRef,
    private snack: MatSnackBar,
    private host: ElementRef<HTMLElement>,
    private zone: NgZone
  ) {}

  private toastSuccess(message: string, duration = 6500): void {
    this.snack.open(message, 'OK', {
      duration,
      panelClass: ['snack-success'],
    });
  }

  private toastError(message: string, duration = 9500): void {
    this.snack.open(message, 'Dismiss', {
      duration,
      panelClass: ['snack-error'],
    });
  }

  private mark(): void {
    if (this.destroyed) return;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.buildForm();
    this.wireReactiveBehaviors();

    // ✅ If modal is created already open (common with *ngIf),
    // ngOnChanges ran before the form existed, so we must open here.
    if (this.open && !this.openedOnce) {
      this.openedOnce = true;
      this.onOpen();
    }

    this.mark();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) return;

    if (changes['open']?.currentValue === true && !this.openedOnce) {
      this.openedOnce = true;
      this.onOpen();
      return;
    }

    if (changes['open']) {
      const wasOpen = changes['open'].previousValue === true;
      const nowOpen = changes['open'].currentValue === true;

      if (!wasOpen && nowOpen) this.onOpen();
      if (wasOpen && !nowOpen) this.resetTransientState();
    }

    if (
      this.open &&
      (changes['mode'] || changes['abstractId'] || changes['initialData'])
    ) {
      this.onOpen();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isReadOnly(): boolean {
    return this.mode === 'view' || this.saving;
  }

  get selectedPresentation(): PreferredPresentationType | '' {
    return (this.form?.controls.preferredPresentationTypes.value?.[0] ??
      '') as PreferredPresentationType | '';
  }

  get selectedScientificCategory(): ScientificCategory | '' {
    return (this.form?.controls.scientificCategories.value?.[0] ??
      '') as ScientificCategory | '';
  }

  setPresentationSingle(value: string): void {
    if (this.isReadOnly) return;

    const v = (value || '') as PreferredPresentationType | '';
    this.form.controls.preferredPresentationTypes.setValue(v ? [v] : [], {
      emitEvent: true,
    });
    this.form.controls.preferredPresentationTypes.markAsTouched();
    this.form.controls.preferredPresentationTypes.updateValueAndValidity({
      emitEvent: false,
    });
    this.mark();
  }

  setCategorySingle(value: string): void {
    if (this.isReadOnly) return;

    const v = (value || '') as ScientificCategory | '';
    this.form.controls.scientificCategories.setValue(v ? [v] : [], {
      emitEvent: true,
    });
    this.form.controls.scientificCategories.markAsTouched();
    this.form.controls.scientificCategories.updateValueAndValidity({
      emitEvent: false,
    });
    this.mark();
  }

  private normalizeSingleSelectArrays(): void {
    const ppt = this.form.controls.preferredPresentationTypes.value || [];
    if (ppt.length > 1) {
      this.form.controls.preferredPresentationTypes.setValue([ppt[0]], {
        emitEvent: false,
      });
    }

    const cats = this.form.controls.scientificCategories.value || [];
    if (cats.length > 1) {
      this.form.controls.scientificCategories.setValue([cats[0]], {
        emitEvent: true,
      });
    } else {
      this.applyOtherCategoryValidators(cats);
    }
  }

  private applyOtherCategoryValidators(
    cats: ScientificCategory[] | null | undefined
  ): void {
    const needsOther = (cats || []).includes('OTHER');
    const ctrl = this.form.controls.otherCategoryText;

    if (needsOther) {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
      ctrl.setValue('', { emitEvent: false });
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  // ✅ Do NOT close when clicking outside (overlay)
  onOverlayClick(): void {
    return;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.open) return;
    if (this.saving) return;
    if (event.key !== 'Escape') return;

    // ✅ Do NOT close on ESC (only close via close button)
    event.preventDefault();
    return;
  }

  onClose(): void {
    if (this.saving) return;
    this.resetTransientState();
    this.closed.emit();
    this.mark();
  }

  onCancel(): void {
    if (this.saving) return;

    if (this.mode === 'edit' && this.loaded) {
      this.patchFormFromDto(this.loaded);
      this.removeAttachmentIds.clear();
      this.newFiles = [];
      this.filesError = '';
      this.statusLine = '';
      this.mark();
    }

    this.onClose();
  }

  /* -----------------------------
   * ✅ Scroll to first invalid field on submit
   * ----------------------------- */

  private getFirstInvalidKey(): keyof AbstractFormShape | null {
    // Special: if keywords array invalid, scroll to keywordsInput (visible control)
    if (this.form?.controls?.keywords?.invalid) return 'keywordsInput';

    for (const key of this.fieldOrder) {
      const c = this.form.controls[key];
      if (!c) continue;

      // Other category only matters if OTHER selected
      if (key === 'otherCategoryText') {
        if (this.form.controls.otherCategoryText.invalid) return 'otherCategoryText';
        continue;
      }

      // Arrays (presentation/category) might be rendered as custom UI; still try to anchor them
      if (key === 'preferredPresentationTypes') {
        if (this.form.controls.preferredPresentationTypes.invalid) return 'preferredPresentationTypes';
        continue;
      }

      if (key === 'scientificCategories') {
        if (this.form.controls.scientificCategories.invalid) return 'scientificCategories';
        continue;
      }

      if (c.invalid) return key;
    }
    return null;
  }

  private scrollToField(key: keyof AbstractFormShape): void {
    if (this.destroyed) return;

    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        const root = this.host.nativeElement;

        // Optional anchors (recommended in template):
        // <section data-control="preferredPresentationTypes">...</section>
        const anchored =
          root.querySelector(`[data-control="${String(key)}"]`) as HTMLElement | null;

        const byFormControlName =
          (root.querySelector(
            `[formControlName="${String(key)}"]`
          ) as HTMLElement | null) ||
          (root.querySelector(
            `[formcontrolname="${String(key)}"]`
          ) as HTMLElement | null);

        // Keywords: visible input is keywordsInput; array control is keywords
        const resolvedEl =
          anchored ||
          byFormControlName ||
          (root.querySelector(
            `[name="${String(key)}"]`
          ) as HTMLElement | null);

        if (!resolvedEl) return;

        // Prefer a modal-body scroll container if you have one
        const scrollContainer =
          (root.querySelector('[data-scroll-container]') as HTMLElement | null) ||
          (root.querySelector('.modal__body') as HTMLElement | null) ||
          null;

        if (scrollContainer) {
          const elRect = resolvedEl.getBoundingClientRect();
          const scRect = scrollContainer.getBoundingClientRect();
          const top = elRect.top - scRect.top + scrollContainer.scrollTop;
          scrollContainer.scrollTo({
            top: Math.max(0, top - 20),
            behavior: 'smooth',
          });
        } else {
          resolvedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const focusable =
          (resolvedEl.matches('input,select,textarea,button')
            ? (resolvedEl as HTMLElement)
            : (resolvedEl.querySelector(
                'input,select,textarea,button'
              ) as HTMLElement | null)) || null;

        try {
          focusable?.focus({ preventScroll: true } as any);
        } catch {
          // ignore
        }
      });
    });
  }

  private scrollToFirstInvalid(): void {
    const key = this.getFirstInvalidKey();
    if (!key) return;
    this.scrollToField(key);
  }

  /* -----------------------------
   * ✅ Hydration helpers (fix view/edit not populating)
   * ----------------------------- */

  private dtoLooksIncomplete(dto?: AbstractDTO | null): boolean {
    if (!dto) return true;

    const anyDto: any = dto as any;

    // Common omissions in list endpoints: abstractText, keywords, coAuthorsRaw, attachments details
    const hasText =
      typeof anyDto.abstractText === 'string' &&
      anyDto.abstractText.trim().length > 0;
    const hasTitle =
      typeof anyDto.abstractTitle === 'string' &&
      anyDto.abstractTitle.trim().length > 0;

    const ppt = anyDto.preferredPresentationTypes;
    const cats = anyDto.scientificCategories;
    const kws = anyDto.keywords;

    const hasPpt = Array.isArray(ppt) && ppt.length > 0;
    const hasCats = Array.isArray(cats) && cats.length > 0;
    const hasKws = Array.isArray(kws) && kws.length > 0;

    const atts = anyDto.attachments;
    const hasAttachmentsArray = Array.isArray(atts);
    const attachmentsNeedHydration =
      hasAttachmentsArray &&
      atts.length > 0 &&
      // if list returns attachments without storedName/url, we need to refetch
      !atts.some((a: any) => a?.storedName || a?.url);

    // if core bits missing, hydrate
    if (!hasTitle) return true;
    if (!hasText) return true;
    if (!hasPpt) return true;
    if (!hasCats) return true;
    if (!hasKws) return true;
    if (attachmentsNeedHydration) return true;

    return false;
  }

  /* -----------------------------
   * Open lifecycle
   * ----------------------------- */

  private onOpen(): void {
    this.statusLine = '';
    this.loadError = '';
    this.filesError = '';
    this.removeAttachmentIds.clear();
    this.newFiles = [];
    this.mark();

    if (this.mode === 'create') {
      this.loaded = null;
      this.existingAttachments = [];
      this.resetFormToBlank();
      this.applyModeRules();
      this.mark();
      return;
    }

    const id = this.abstractId || this.getId(this.initialData);
    if (!id) {
      this.loadError = 'Missing abstractId for view/edit mode.';
      this.applyModeRules();
      this.mark();
      return;
    }

    // ✅ Patch immediately for fast UI (if available)
    if (this.initialData && this.getId(this.initialData) === id) {
      this.loaded = this.initialData;
      this.existingAttachments = (this.initialData as any).attachments || [];
      this.patchFormFromDto(this.initialData);
      this.applyModeRules();
      this.mark();

      // ✅ BUT: if list item is incomplete, hydrate from server
      if (this.dtoLooksIncomplete(this.initialData)) {
        this.fetchAbstract(id);
      }

      return;
    }

    // no initialData or mismatched -> always fetch
    this.fetchAbstract(id);
  }

  private fetchAbstract(id: string): void {
    this.loading = true;
    this.loadError = '';
    this.statusLine = 'Loading…';
    this.mark();

    this.abstracts
      .getMyAbstract(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dto) => {
          this.loaded = dto;
          this.existingAttachments = (dto as any)?.attachments || [];
          this.patchFormFromDto(dto);
          this.applyModeRules();
          this.statusLine = '';
          this.loading = false;

          // IMPORTANT: entering edit/view should clear transient attachment state
          this.removeAttachmentIds.clear();
          this.newFiles = [];
          this.filesError = '';

          this.mark();
        },
        error: (err) => {
          this.loading = false;
          this.loadError = this.readApiError(err) || 'Failed to load abstract.';
          this.statusLine = this.loadError;
          this.toastError(this.loadError);
          this.applyModeRules();
          this.mark();
        },
      });
  }

  private resetTransientState(): void {
    this.loading = false;
    this.saving = false;
    this.statusLine = '';
    this.loadError = '';
    this.filesError = '';
    this.removeAttachmentIds.clear();
    this.newFiles = [];
    this.abstractWordCount = 0;
  }

  /* -----------------------------
   * Form setup
   * ----------------------------- */

  private buildForm(): void {
    this.form = this.fb.group<AbstractFormShape>({
      presentingAuthorName: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      correspondingAuthorName: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      correspondingAuthorEmail: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.email],
      }),

      abstractTitle: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      preferredPresentationTypes: this.fb.control<PreferredPresentationType[]>(
        [],
        { nonNullable: true, validators: [this.minArrayLength(1)] }
      ),

      scientificCategories: this.fb.control<ScientificCategory[]>(
        [],
        { nonNullable: true, validators: [this.minArrayLength(1)] }
      ),

      otherCategoryText: this.fb.control('', { nonNullable: true }),

      abstractText: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      keywords: this.fb.control<string[]>(
        [],
        {
          nonNullable: true,
          validators: [this.minArrayLength(1), this.maxArrayLength(5)],
        }
      ),

      keywordsInput: this.fb.control('', { nonNullable: true }),

      coAuthorsRaw: this.fb.control('', { nonNullable: true }),

      decl_originalWork: this.fb.control(false, { nonNullable: true }),
      decl_authorsApproved: this.fb.control(false, { nonNullable: true }),
      decl_agreeProceedings: this.fb.control(false, { nonNullable: true }),
    });
  }

  private wireReactiveBehaviors(): void {
    this.form.controls.abstractText.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((text) => {
        this.abstractWordCount = this.countWords(text || '');
        this.mark();
      });

    this.form.controls.scientificCategories.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((cats) => {
        this.applyOtherCategoryValidators(cats || []);
        this.mark();
      });

    this.form.controls.keywordsInput.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.syncKeywordsFromInput(false);
        this.mark();
      });
  }

  private applyModeRules(): void {
    this.form.enable({ emitEvent: false });
    this.setDeclarationsValidators(this.mode === 'create');

    if (this.mode === 'view') {
      this.form.disable({ emitEvent: false });
    }
  }

  private setDeclarationsValidators(required: boolean): void {
    const v = required ? [Validators.requiredTrue] : [];
    this.form.controls.decl_originalWork.setValidators(v);
    this.form.controls.decl_authorsApproved.setValidators(v);
    this.form.controls.decl_agreeProceedings.setValidators(v);

    this.form.controls.decl_originalWork.updateValueAndValidity({
      emitEvent: false,
    });
    this.form.controls.decl_authorsApproved.updateValueAndValidity({
      emitEvent: false,
    });
    this.form.controls.decl_agreeProceedings.updateValueAndValidity({
      emitEvent: false,
    });
  }

  private resetFormToBlank(): void {
    this.form.reset(
      {
        presentingAuthorName: '',
        correspondingAuthorName: '',
        correspondingAuthorEmail: '',
        abstractTitle: '',
        preferredPresentationTypes: [],
        scientificCategories: [],
        otherCategoryText: '',
        abstractText: '',
        keywords: [],
        keywordsInput: '',
        coAuthorsRaw: '',
        decl_originalWork: false,
        decl_authorsApproved: false,
        decl_agreeProceedings: false,
      },
      { emitEvent: false }
    );

    this.abstractWordCount = 0;
    this.applyOtherCategoryValidators([]);
  }

  private patchFormFromDto(dto: AbstractDTO): void {
    this.form.patchValue(
      {
        presentingAuthorName: (dto as any).presentingAuthorName || '',
        correspondingAuthorName: (dto as any).correspondingAuthorName || '',
        correspondingAuthorEmail:
          (dto as any).correspondingAuthorEmail || '',
        abstractTitle: (dto as any).abstractTitle || '',
        preferredPresentationTypes: ((dto as any).preferredPresentationTypes ||
          []) as PreferredPresentationType[],
        scientificCategories: ((dto as any).scientificCategories ||
          []) as ScientificCategory[],
        otherCategoryText: (dto as any).otherCategoryText || '',
        abstractText: (dto as any).abstractText || '',
        keywords: ((dto as any).keywords || []) as string[],
        keywordsInput: (((dto as any).keywords || []) as string[]).join(', '),
        coAuthorsRaw: (dto as any).coAuthorsRaw || '',
      },
      { emitEvent: false }
    );

    this.normalizeSingleSelectArrays();
    this.abstractWordCount = this.countWords((dto as any).abstractText || '');
    this.mark();
  }

  /* -----------------------------
   * Template helpers
   * ----------------------------- */

  hasCategory(v: ScientificCategory): boolean {
    return (this.form.controls.scientificCategories.value || []).includes(v);
  }

  scientificCategoryLabel(v: ScientificCategory): string {
    switch (v) {
      case 'ACUTE_STROKE_MANAGEMENT':
        return 'Acute Stroke Management';
      case 'STROKE_PREVENTION':
        return 'Stroke Prevention';
      case 'NEUROIMAGING_AND_DIAGNOSTICS':
        return 'Neuroimaging and Diagnostics';
      case 'REHABILITATION_AND_RECOVERY':
        return 'Rehabilitation and Recovery';
      case 'BASIC_AND_TRANSLATIONAL_RESEARCH':
        return 'Basic and Translational Research';
      case 'HEALTH_SYSTEMS_AND_POLICY':
        return 'Health Systems and Policy';
      case 'OTHER':
        return 'Other';
      default:
        return v;
    }
  }

  /* -----------------------------
   * Keywords
   * ----------------------------- */

  keywords(): string[] {
    return this.form.controls.keywords.value || [];
  }

  syncKeywordsFromInput(markTouched = true): void {
    const raw = this.form.controls.keywordsInput.value || '';
    const parsed = this.parseKeywords(raw);

    this.form.controls.keywords.setValue(parsed, { emitEvent: false });
    if (markTouched) this.form.controls.keywords.markAsTouched();
    this.form.controls.keywords.updateValueAndValidity({ emitEvent: false });
  }

  removeKeyword(k: string): void {
    const current = this.keywords();
    const next = current.filter((x) => x !== k);
    this.form.controls.keywords.setValue(next, { emitEvent: true });
    this.form.controls.keywords.markAsTouched();
    this.form.controls.keywordsInput.setValue(next.join(', '), {
      emitEvent: false,
    });
    this.mark();
  }

  private parseKeywords(input: string): string[] {
    const tokens = input
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const deduped: string[] = [];
    for (const t of tokens) {
      const norm = t.replace(/\s+/g, ' ').trim();
      if (!norm) continue;
      if (!deduped.some((x) => x.toLowerCase() === norm.toLowerCase())) {
        deduped.push(norm);
      }
      if (deduped.length >= 5) break;
    }
    return deduped;
  }

  /* -----------------------------
   * Attachments
   * ----------------------------- */

  onFilesSelected(event: Event): void {
    this.filesError = '';
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    const existingCount = this.existingAttachments.length;
    const removedCount = this.removeAttachmentIds.size;
    const effectiveExisting =
      this.mode === 'edit' ? existingCount - removedCount : existingCount;

    const currentNew = this.newFiles.length;
    const maxAllowed = 5;

    const availableSlots = Math.max(
      0,
      maxAllowed - (effectiveExisting + currentNew)
    );
    if (availableSlots <= 0) {
      this.filesError =
        'You already have 5 attachments. Remove one before adding more.';
      input.value = '';
      this.toastError(this.filesError);
      this.mark();
      return;
    }

    const accepted = files.slice(0, availableSlots);
    const rejected = files.length > accepted.length;

    const allowedExt = /\.(pdf|doc|docx)$/i;
    const bad = accepted.find((f) => !allowedExt.test(f.name));
    if (bad) {
      this.filesError = 'Only PDF, DOC, or DOCX files are allowed.';
      input.value = '';
      this.toastError(this.filesError);
      this.mark();
      return;
    }

    this.newFiles = [...this.newFiles, ...accepted];

    if (rejected) {
      this.filesError = `Only ${availableSlots} file(s) were added (max 5 total).`;
      this.toastError(this.filesError);
    }

    input.value = '';
    this.mark();
  }

  removeNewFile(index: number): void {
    if (this.saving) return;
    this.newFiles = this.newFiles.filter((_, i) => i !== index);
    this.mark();
  }

  openAttachment(a: AttachmentDTO): void {
    const url =
      (a as any).url ||
      this.abstracts.buildAttachmentUrl((a as any).storedName);
    window.open(url, '_blank', 'noopener');
  }

  isMarkedRemoved(a: AttachmentDTO): boolean {
    return this.removeAttachmentIds.has(String((a as any)._id));
  }

  toggleRemoveAttachment(a: AttachmentDTO): void {
    if (this.mode !== 'edit') return;
    if (this.saving) return;

    const id = String((a as any)._id);
    if (this.removeAttachmentIds.has(id)) {
      this.removeAttachmentIds.delete(id);
    } else {
      this.removeAttachmentIds.add(id);
      this.filesError = '';
    }
    this.mark();
  }

  /* -----------------------------
   * Submit
   * ----------------------------- */

  onSubmit(): void {
    if (this.saving || this.loading) return;

    this.syncKeywordsFromInput(true);

    if (this.abstractWordCount > 300) {
      this.statusLine = 'Abstract text must be 300 words or less.';
      this.form.controls.abstractText.markAsTouched();
      this.toastError(this.statusLine);
      this.mark();

      // ✅ Scroll to the field
      this.scrollToField('abstractText');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.statusLine = 'Please fix the highlighted errors.';
      this.toastError(this.statusLine);
      this.mark();

      // ✅ Scroll to first invalid field
      this.scrollToFirstInvalid();
      return;
    }

    if (this.mode === 'create') return this.submitCreate();

    if (this.mode === 'edit') {
      const id = this.abstractId || this.getId(this.loaded);
      if (!id) {
        this.statusLine = 'Missing abstract id.';
        this.toastError(this.statusLine);
        this.mark();
        return;
      }
      return this.submitEdit(id);
    }
  }

  private submitCreate(): void {
    this.saving = true;
    this.statusLine = 'Submitting…';
    this.mark();

    const v = this.form.getRawValue();

    const payload = {
      presentingAuthorName: v.presentingAuthorName,
      correspondingAuthorName: v.correspondingAuthorName,
      correspondingAuthorEmail: v.correspondingAuthorEmail || '',
      abstractTitle: v.abstractTitle,
      preferredPresentationTypes: v.preferredPresentationTypes,
      scientificCategories: v.scientificCategories,
      otherCategoryText: v.otherCategoryText || '',
      abstractText: v.abstractText,
      keywords: v.keywords,
      coAuthorsRaw: v.coAuthorsRaw || '',
      declarations: {
        originalWork: v.decl_originalWork,
        authorsApproved: v.decl_authorsApproved,
        agreeProceedings: v.decl_agreeProceedings,
      },
    };

    this.abstracts
      .createAbstract(payload, this.newFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dto) => {
          this.saving = false;
          this.statusLine = 'Submitted successfully.';
          this.toastSuccess('Abstract submitted successfully.');
          this.saved.emit(dto);
          this.onClose();
          this.mark();
        },
        error: (err) => {
          this.saving = false;
          this.statusLine =
            this.readApiError(err) || 'Failed to submit abstract.';
          this.toastError(this.statusLine);
          this.mark();
        },
      });
  }

  private submitEdit(id: string): void {
    this.saving = true;
    this.statusLine = 'Saving…';
    this.mark();

    const v = this.form.getRawValue();

    const updates: SaveAllInOneUpdates = {
      presentingAuthorName: v.presentingAuthorName,
      correspondingAuthorName: v.correspondingAuthorName,
      correspondingAuthorEmail: v.correspondingAuthorEmail || '',
      abstractTitle: v.abstractTitle,
      preferredPresentationTypes: v.preferredPresentationTypes,
      scientificCategories: v.scientificCategories,
      otherCategoryText: v.otherCategoryText || '',
      abstractText: v.abstractText,
      keywords: v.keywords,
      coAuthorsRaw: v.coAuthorsRaw || '',
    };

    if (!updates.scientificCategories.includes('OTHER')) {
      updates.otherCategoryText = '';
    }

    const removeIds = Array.from(this.removeAttachmentIds);

    this.abstracts
      .saveAbstractAllInOne(id, updates, removeIds, this.newFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dto) => {
          this.saving = false;
          this.statusLine = 'Saved.';
          this.toastSuccess('Changes saved.');
          this.saved.emit(dto);
          this.onClose();
          this.mark();
        },
        error: (err) => {
          this.saving = false;
          this.statusLine =
            this.readApiError(err) || 'Failed to save changes.';
          this.toastError(this.statusLine);
          this.mark();
        },
      });
  }

  /* -----------------------------
   * Errors
   * ----------------------------- */

  fieldError<K extends keyof AbstractFormShape>(key: K): string {
    const c = this.form?.controls?.[key];
    if (!c) return '';
    if (!(c.touched || c.dirty)) return '';

    if (c.errors?.['required']) return 'This field is required.';
    if (c.errors?.['email']) return 'Please enter a valid email address.';
    if (c.errors?.['minArrayLength']) return 'Select at least one option.';
    if (c.errors?.['maxArrayLength']) return 'Maximum 5 items allowed.';
    return '';
  }

  declError(
    key: 'decl_originalWork' | 'decl_authorsApproved' | 'decl_agreeProceedings'
  ): string {
    const c = this.form.controls[key];
    if (!(c.touched || c.dirty)) return '';
    if (c.errors?.['requiredTrue']) return 'You must agree to proceed.';
    return '';
  }

  abstractTextError(): string {
    const c = this.form.controls.abstractText;
    if (!(c.touched || c.dirty)) {
      return this.abstractWordCount > 300
        ? 'Abstract text must be 300 words or less.'
        : '';
    }
    if (c.errors?.['required']) return 'Abstract text is required.';
    if (this.abstractWordCount > 300)
      return 'Abstract text must be 300 words or less.';
    return '';
  }

  /* -----------------------------
   * Validators
   * ----------------------------- */

  private minArrayLength(min: number) {
    return (control: AbstractControl) => {
      const v = control.value as unknown;
      const len = Array.isArray(v) ? v.length : 0;
      return len >= min ? null : { minArrayLength: true };
    };
  }

  private maxArrayLength(max: number) {
    return (control: AbstractControl) => {
      const v = control.value as unknown;
      const len = Array.isArray(v) ? v.length : 0;
      return len <= max ? null : { maxArrayLength: true };
    };
  }

  /* -----------------------------
   * Utils
   * ----------------------------- */

  prettyBytes(bytes: number): string {
    const b = Number(bytes || 0);
    if (b < 1024) return `${b} B`;
    const kb = b / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  private countWords(text: string): number {
    const t = (text || '').trim();
    if (!t) return 0;
    return t.split(/\s+/g).filter(Boolean).length;
  }

  private getId(dto?: AbstractDTO | null): string | undefined {
    if (!dto) return undefined;
    return ((dto as any).id || (dto as any)._id || undefined) as
      | string
      | undefined;
  }

  private readApiError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      (typeof err?.error === 'string' ? err.error : '') ||
      ''
    );
  }
}
