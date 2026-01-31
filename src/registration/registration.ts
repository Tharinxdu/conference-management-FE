import { Component, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../environments/environment';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { EMPTY } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { PageShell } from '../page-shell/page-shell';

export const COUNTRY_INCOME_GROUPS: Record<string, string> = {
  // LOW / LOWER-MIDDLE INCOME ECONOMIES
  Afghanistan: 'LOWER',
  "Korea, Dem. People's Rep": 'LOWER',
  Somalia: 'LOWER',
  'Burkina Faso': 'LOWER',
  Liberia: 'LOWER',
  'South Sudan': 'LOWER',
  Burundi: 'LOWER',
  Madagascar: 'LOWER',
  Sudan: 'LOWER',
  'Central African Republic': 'LOWER',
  Malawi: 'LOWER',
  'Syrian Arab Republic': 'LOWER',
  Chad: 'LOWER',
  Mali: 'LOWER',
  Togo: 'LOWER',
  'Congo, Dem. Rep': 'LOWER',
  Mozambique: 'LOWER',
  Uganda: 'LOWER',
  Eritrea: 'LOWER',
  Niger: 'LOWER',
  'Yemen, Rep.': 'LOWER',
  'Gambia, The': 'LOWER',
  Rwanda: 'LOWER',
  'Guinea-Bissau': 'LOWER',
  'Sierra Leone': 'LOWER',

  Angola: 'LOWER',
  India: 'LOWER',
  'Papua New Guinea': 'LOWER',
  Bangladesh: 'LOWER',
  Jordan: 'LOWER',
  Philippines: 'LOWER',
  Benin: 'LOWER',
  Kenya: 'LOWER',
  'São Tomé and Principe': 'LOWER',
  Bhutan: 'LOWER',
  Kiribati: 'LOWER',
  Senegal: 'LOWER',
  Bolivia: 'LOWER',
  'Kyrgyz Republic': 'LOWER',
  'Solomon Islands': 'LOWER',
  Cambodia: 'LOWER',
  'Lao PDR': 'LOWER',

  // Sri Lanka uses LOCAL pricing override later
  'Sri Lanka': 'LOWER',

  Cameroon: 'LOWER',
  Lebanon: 'LOWER',
  Tajikistan: 'LOWER',
  Comoros: 'LOWER',
  Lesotho: 'LOWER',
  Tanzania: 'LOWER',
  'Congo, Rep.': 'LOWER',
  Mauritania: 'LOWER',
  'Timor-Leste': 'LOWER',
  "Côte d'Ivoire": 'LOWER',
  'Micronesia, Fed. Sts.': 'LOWER',
  Tunisia: 'LOWER',
  Djibouti: 'LOWER',
  Morocco: 'LOWER',
  Uzbekistan: 'LOWER',
  'Egypt, Arab Rep.': 'LOWER',
  Myanmar: 'LOWER',
  Vanuatu: 'LOWER',
  Eswatini: 'LOWER',
  Namibia: 'LOWER',
  'Viet Nam': 'LOWER',
  Ghana: 'LOWER',
  Nepal: 'LOWER',
  'West Bank and Gaza': 'LOWER',
  Guinea: 'LOWER',
  Nicaragua: 'LOWER',
  Zambia: 'LOWER',
  Haiti: 'LOWER',
  Nigeria: 'LOWER',
  Zimbabwe: 'LOWER',
  Honduras: 'LOWER',
  Pakistan: 'LOWER',

  // UPPER-MIDDLE / HIGH INCOME ECONOMIES
  Albania: 'UPPER',
  'Equatorial Guinea': 'UPPER',
  Moldova: 'UPPER',
  Algeria: 'UPPER',
  Fiji: 'UPPER',
  Mongolia: 'UPPER',
  Argentina: 'UPPER',
  Gabon: 'UPPER',
  Montenegro: 'UPPER',
  Armenia: 'UPPER',
  Georgia: 'UPPER',
  'North Macedonia': 'UPPER',
  Azerbaijan: 'UPPER',
  Grenada: 'UPPER',
  Paraguay: 'UPPER',
  Belarus: 'UPPER',
  Guatemala: 'UPPER',
  Peru: 'UPPER',
  Belize: 'UPPER',
  Indonesia: 'UPPER',
  Samoa: 'UPPER',
  'Bosnia and Herzegovina': 'UPPER',
  'Iran, Islamic Rep.': 'UPPER',
  Serbia: 'UPPER',
  Botswana: 'UPPER',
  Iraq: 'UPPER',
  'South Africa': 'UPPER',
  Brazil: 'UPPER',
  Jamaica: 'UPPER',
  'St. Lucia': 'UPPER',
  'Cabo Verde': 'UPPER',
  Kazakhstan: 'UPPER',
  'St. Vincent and the Grenadines': 'UPPER',
  China: 'UPPER',
  Kosovo: 'UPPER',
  Suriname: 'UPPER',
  Colombia: 'UPPER',
  Libya: 'UPPER',
  Thailand: 'UPPER',
  Cuba: 'UPPER',
  Malaysia: 'UPPER',
  Tonga: 'UPPER',
  Dominica: 'UPPER',
  Maldives: 'UPPER',
  Türkiye: 'UPPER',
  'Dominican Republic': 'UPPER',
  'Marshall Islands': 'UPPER',
  Turkmenistan: 'UPPER',
  Ecuador: 'UPPER',
  Mauritius: 'UPPER',
  Tuvalu: 'UPPER',
  'El Salvador': 'UPPER',
  Mexico: 'UPPER',
  Ukraine: 'UPPER',

  'American Samoa': 'UPPER',
  Gibraltar: 'UPPER',
  Panama: 'UPPER',
  Andorra: 'UPPER',
  Greece: 'UPPER',
  Poland: 'UPPER',
  'Antigua and Barbuda': 'UPPER',
  Greenland: 'UPPER',
  Portugal: 'UPPER',
  Aruba: 'UPPER',
  Guam: 'UPPER',
  'Puerto Rico': 'UPPER',
  Australia: 'UPPER',
  Guyana: 'UPPER',
  Qatar: 'UPPER',
  Austria: 'UPPER',
  'Hong Kong SAR, China': 'UPPER',
  Romania: 'UPPER',
  'Bahamas, The': 'UPPER',
  Hungary: 'UPPER',
  'Russian Federation': 'UPPER',
  Bahrain: 'UPPER',
  Iceland: 'UPPER',
  'San Marino': 'UPPER',
  Barbados: 'UPPER',
  Ireland: 'UPPER',
  'Saudi Arabia': 'UPPER',
  Belgium: 'UPPER',
  'Isle of Man': 'UPPER',
  Seychelles: 'UPPER',
  Bermuda: 'UPPER',
  Israel: 'UPPER',
  Singapore: 'UPPER',
  'British Virgin Islands': 'UPPER',
  Italy: 'UPPER',
  'Sint Maarten (Dutch part)': 'UPPER',
  'Brunei Darussalam': 'UPPER',
  Japan: 'UPPER',
  'Slovak Republic': 'UPPER',
  Slovenia: 'UPPER',
  Canada: 'UPPER',
  Kuwait: 'UPPER',
  Spain: 'UPPER',
  'Cayman Islands': 'UPPER',
  Latvia: 'UPPER',
  'St. Kitts and Nevis': 'UPPER',
  'Channel Islands': 'UPPER',
  Liechtenstein: 'UPPER',
  'St. Martin (French part)': 'UPPER',
  Chile: 'UPPER',
  Lithuania: 'UPPER',
  Sweden: 'UPPER',
  'Costa Rica': 'UPPER',
  Luxembourg: 'UPPER',
  Switzerland: 'UPPER',
  Croatia: 'UPPER',
  'Macao SAR, China': 'UPPER',
  'Taiwan, China': 'UPPER',
  Curaçao: 'UPPER',
  Malta: 'UPPER',
  'Trinidad and Tobago': 'UPPER',
  Cyprus: 'UPPER',
  Monaco: 'UPPER',
  'Turks and Caicos Islands': 'UPPER',
  Czechia: 'UPPER',
  Nauru: 'UPPER',
  'United Arab Emirates': 'UPPER',
  Denmark: 'UPPER',
  Netherlands: 'UPPER',
  'United Kingdom': 'UPPER',
  Estonia: 'UPPER',
  'New Caledonia': 'UPPER',
  'United States': 'UPPER',
  'Faroe Islands': 'UPPER',
  'New Zealand': 'UPPER',
  Uruguay: 'UPPER',
  Finland: 'UPPER',
  'Northern Mariana Islands': 'UPPER',
  'Virgin Islands (U.S.)': 'UPPER',
  France: 'UPPER',
  Norway: 'UPPER',
  'French Polynesia': 'UPPER',
  Oman: 'UPPER',
  Germany: 'UPPER',
  Palau: 'UPPER',
};

function getIncomeGroup(country: string): string | null {
  return COUNTRY_INCOME_GROUPS[country] || null;
}

export const FEE_RULES = {
  full: {
    LOWER: {
      physician: { early: 75, late: 100 },
      'non-physician': { early: 25, late: 40 },
    },
    UPPER: {
      physician: { early: 200, late: 225 },
      'non-physician': { early: 75, late: 100 },
    },
    LOCAL: {
      physician: { early: 30, late: 80 },
      'non-physician': { early: 20, late: 40 },
    },
  },
  rehab: {
    ALL: { early: 15, late: 40 },
  },
};

function getFeePeriod(): 'early' | 'late' {
  const today = new Date();
  const earlyEnd = new Date('2026-09-30');
  return today <= earlyEnd ? 'early' : 'late';
}

function determineIncomeGroup(country: string): string | null {
  if (country === 'Sri Lanka') return 'LOCAL';
  return getIncomeGroup(country);
}

export function calculateFee(args: {
  conferenceType: string;
  participantCategory: string;
  incomeGroup: string;
  date: Date;
}): number | null {
  const { conferenceType, participantCategory, incomeGroup } = args;
  const period = getFeePeriod();

  if (conferenceType === 'rehab') {
    return FEE_RULES.rehab.ALL[period];
  }

  const groupFees = (FEE_RULES.full as any)[incomeGroup];
  if (!groupFees) return null;

  const catFees = groupFees[participantCategory as 'physician' | 'non-physician'];
  if (!catFees) return null;

  return catFees[period];
}

type RegistrationResponse = {
  registrationId?: string;
  feeAmount?: number;
  paymentStatus?: string;
  message?: string;
};

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, PageShell],
  templateUrl: './registration.html',
  styleUrl: './registration.scss',
})
export class Registration implements OnInit {
  // Form model properties
  title = '';
  firstName = '';
  lastName = '';
  designation = '';
  institution = '';
  country = '';
  email = '';
  mobile = '';
  participantCategory = '';
  conferenceType: string | null = null;

  consentDataUse = false;
  consentTerms = false;

  // Fee + income
  feeAmount: number | null = null;
  incomeGroup: string | null = null;
  feeAmountDisplay = 'Select your country, category, and participation type to see the fee.';

  // Period / badge
  currentPeriod: 'early' | 'late' = getFeePeriod();
  feePeriodText = '';
  feePeriodBadgeText = '';

  // UI state
  formStatus = '';
  submitting = false; // ✅ NEW: prevents double submit + controls UI
  successVisible = false;
  registrationCardHidden = false;
  successDetails = '';

  // Error messages mapped by field name (matches data-error-for)
  errorMessages: Record<string, string> = {};

  // Keeps the order of invalid fields from the last validation run
  private validationErrorOrder: string[] = [];

  // Country list for dropdown
  countries: string[] = [];

  // Modal visibility
  showDataUseModal = false;
  showTermsModal = false;
  showCancellationModal = false;

  private readonly apiUrl = environment.apiUrl;

  countryCodes = signal<any[]>([]);
  countryCode: string = '';
  mobileExample: string = '+94 71 234 5678';

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.countries = Object.keys(COUNTRY_INCOME_GROUPS).sort();

    this.currentPeriod = getFeePeriod();
    this.feePeriodBadgeText =
      this.currentPeriod === 'early'
        ? 'EARLY BIRD (1st Mar – 30th Sep 2026)'
        : 'LATE (1st Oct – 28th Nov 2026)';

    this.feePeriodText =
      this.currentPeriod === 'early'
        ? 'You are registering during the Early Bird period.'
        : 'You are registering during the Late period.';

    try {
      const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,idd,flags');
      const data = await res.json();

      const cleaned = data
        .filter((c: any) => c.idd?.root && c.idd?.suffixes?.length > 0)
        .map((c: any) => ({
          name: c.name.common,
          code: c.cca2,
          dial_code: `${c.idd.root}${c.idd.suffixes[0]}`,
          flag: c.flags?.emoji || '',
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      this.countryCodes.set(cleaned);
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Failed to fetch country codes', err);
    }
  }

  onCountryChange(): void {
    this.updateFeeSummary();
  }

  onParticipantCategoryChange(): void {
    this.updateFeeSummary();
  }

  onConferenceTypeChange(): void {
    this.updateFeeSummary();
  }

  private getSelectedConferenceType(): string | null {
    return this.conferenceType;
  }

  private updateFeeSummary(): void {
    const country = this.country;
    const participantCategory = this.participantCategory;
    const conferenceType = this.getSelectedConferenceType();
    const group = country ? determineIncomeGroup(country) : null;

    if (!country || !participantCategory || !conferenceType || !group) {
      this.feeAmountDisplay = 'Select your country, category, and participation type to see the fee.';
      this.feeAmount = null;
      this.incomeGroup = null;
      return;
    }

    const fee = calculateFee({
      conferenceType,
      participantCategory,
      incomeGroup: group,
      date: new Date(),
    });

    if (fee == null) {
      this.feeAmountDisplay = 'Fee configuration is not available for this combination.';
      this.feeAmount = null;
      this.incomeGroup = group;
      return;
    }

    this.feeAmount = fee;
    this.incomeGroup = group;
    this.feeAmountDisplay = `Total Fee: USD ${fee}`;
  }

  openModal(which: 'dataUse' | 'terms' | 'cancellation'): void {
    if (which === 'dataUse') this.showDataUseModal = true;
    if (which === 'terms') this.showTermsModal = true;
    if (which === 'cancellation') this.showCancellationModal = true;
  }

  closeModal(which: 'dataUse' | 'terms' | 'cancellation'): void {
    if (which === 'dataUse') this.showDataUseModal = false;
    if (which === 'terms') this.showTermsModal = false;
    if (which === 'cancellation') this.showCancellationModal = false;
  }

  onOverlayClick(event: MouseEvent, which: 'dataUse' | 'terms' | 'cancellation'): void {
    if (event.target === event.currentTarget) {
      this.closeModal(which);
    }
  }

  private setError(name: string, message: string | null): void {
    const msg = message || '';

    // Track order only when setting a non-empty error
    if (msg && !this.validationErrorOrder.includes(name)) {
      this.validationErrorOrder.push(name);
    }

    this.errorMessages = {
      ...this.errorMessages,
      [name]: msg,
    };
  }

  private clearAllErrors(): void {
    this.errorMessages = {};
    this.validationErrorOrder = [];
  }

  private scrollToFirstError(): void {
    if (!this.validationErrorOrder.length) return;

    // Wait a tick so Angular renders error messages before scrolling
    setTimeout(() => {
      this.scrollToField(this.validationErrorOrder[0]);
    }, 0);
  }

  private scrollToField(field: string): void {
    const form = document.getElementById('registrationForm');
    if (!form) return;

    // Prefer the error message anchor (works for radios/consent areas too)
    let anchor = form.querySelector(`[data-error-for="${CSS.escape(field)}"]`) as HTMLElement | null;

    // For regular inputs/selects, use the input itself as focus target
    let focusEl: HTMLElement | null = null;

    // Special cases
    if (field === 'conferenceType') {
      focusEl = form.querySelector(`input[name="conferenceType"]`) as HTMLElement | null;
    } else if (field === 'consent') {
      if (!this.consentDataUse) focusEl = document.getElementById('consentDataUse') as HTMLElement | null;
      else if (!this.consentTerms) focusEl = document.getElementById('consentTerms') as HTMLElement | null;
      else focusEl = document.getElementById('consentDataUse') as HTMLElement | null;
    } else {
      // Normal fields: prefer id, fallback to name
      focusEl =
        (document.getElementById(field) as HTMLElement | null) ||
        (form.querySelector(`[name="${CSS.escape(field)}"]`) as HTMLElement | null);
    }

    // If we found an error-message anchor, scroll to a nicer container around it
    if (anchor) {
      anchor =
        (anchor.closest('.form-group, .consent-item, .form-section') as HTMLElement | null) ||
        anchor;
    }

    const target = anchor || focusEl;
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Focus without triggering another scroll jump
    requestAnimationFrame(() => {
      const fallbackFocusable = target.querySelector('input, select, textarea, button') as HTMLElement | null;
      const elToFocus = focusEl || fallbackFocusable;
      if (!elToFocus) return;

      try {
        (elToFocus as any).focus({ preventScroll: true });
      } catch {
        elToFocus.focus();
      }
    });
  }

  private validateForm(): boolean {
    this.clearAllErrors();
    let valid = true;

    const requiredFields = [
      'title',
      'firstName',
      'lastName',
      'designation',
      // 'institution',
      'country',
      'email',
      // 'mobile',
      'participantCategory',
    ];

    const valueOf = (name: string): string => {
      switch (name) {
        case 'title':
          return this.title;
        case 'firstName':
          return this.firstName;
        case 'lastName':
          return this.lastName;
        case 'designation':
          return this.designation;
        // case 'institution':
        //   return this.institution;
        case 'country':
          return this.country;
        case 'email':
          return this.email;
        // case 'mobile':
        //   return this.mobile;
        case 'participantCategory':
          return this.participantCategory;
        default:
          return '';
      }
    };

    requiredFields.forEach((name) => {
      const value = (valueOf(name) || '').trim();
      if (!value) {
        this.setError(name, 'This field is required.');
        valid = false;
      }
    });

    const emailValue = (this.email || '').trim();
    if (emailValue && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailValue)) {
      this.setError('email', 'Please enter a valid email address.');
      valid = false;
    }

    if (!this.getSelectedConferenceType()) {
      this.setError('conferenceType', 'Please select a participation option.');
      valid = false;
    }

    if (this.feeAmount == null) {
      this.setError('conferenceType', 'Fee could not be determined.');
      valid = false;
    }

    if (!this.consentDataUse || !this.consentTerms) {
      this.setError('consent', 'Please accept all required consents.');
      valid = false;
    }

    return valid;
  }

  // ✅ UPDATED SUBMIT: create registration -> initiate OnePay -> redirect to gateway
  onSubmit(): void {
    if (this.submitting) return;

    this.formStatus = '';

    if (!this.validateForm()) {
      this.formStatus = 'Please fix the highlighted errors.';
      this.cdr.markForCheck();
      this.scrollToFirstError();
      return;
    }

    const payload = this.buildPayloadFromForm();

    this.submitting = true;
    this.formStatus = 'Submitting registration...';
    this.cdr.markForCheck();

    this.http
      // 1) Create registration
      .post<any>(`${this.apiUrl}/registrations`, payload)
      .pipe(
        catchError((err) => {
          const msg = err?.error?.message || err?.message || 'Failed to submit registration.';
          this.formStatus = msg;
          this.cdr.markForCheck();
          return EMPTY;
        })
      )
      .subscribe((reg) => {
        if (!reg) return;

        // Your backend returns Mongo document => needs _id for payment initiation
        const registrationMongoId = reg?._id;

        if (!registrationMongoId) {
          this.formStatus = 'Registration created but missing registration id. Please contact support.';
          this.submitting = false;
          this.cdr.markForCheck();
          return;
        }

        // 2) Initiate OnePay
        this.formStatus = 'Redirecting to payment...';
        this.cdr.markForCheck();

        this.http
          .post<any>(`${this.apiUrl}/payments/onepay/initiate`, { registrationMongoId })
          .pipe(
            catchError((err) => {
              const msg =
                err?.error?.message ||
                err?.message ||
                'Registration created but payment initiation failed.';
              this.formStatus = msg;
              this.submitting = false;
              this.cdr.markForCheck();
              return EMPTY;
            }),
            finalize(() => {
              // If we redirect successfully, this won't matter.
              // If initiation fails, we must re-enable the button/UI.
              this.submitting = false;
              this.cdr.markForCheck();
            })
          )
          .subscribe((payRes) => {
            if (!payRes) return;

            const redirectUrl = payRes?.redirectUrl;

            if (!redirectUrl) {
              this.formStatus = 'Payment initiation succeeded but no redirect URL was returned.';
              this.cdr.markForCheck();
              return;
            }

            // ✅ Redirect user to OnePay gateway
            window.location.assign(redirectUrl);
          });
      });
  }

  private buildPayloadFromForm(): any {
    const conferenceType = this.getSelectedConferenceType();

    return {
      title: this.title,
      firstName: this.firstName,
      lastName: this.lastName,
      designation: this.designation,
      institution: this.institution,
      country: this.country,
      email: this.email,
      // mobile: `${this.countryCode}${this.mobile}`,
      participantCategory: this.participantCategory,
      conferenceType,
      feeAmountClient: this.feeAmount !== null ? Number(this.feeAmount) : null,
      incomeGroup: this.incomeGroup || null,
      consentDataUse: this.consentDataUse,
      consentTerms: this.consentTerms,
    };
  }
}
