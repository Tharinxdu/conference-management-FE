import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../environments/environment';
import { HttpClientModule } from '@angular/common/http';

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
  Palau: 'UPPER'
};

function getIncomeGroup(country: string): string | null {
  return COUNTRY_INCOME_GROUPS[country] || null;
}

// ---------------------------------------------------------------------------
// FEE RULES (unchanged data)
// ---------------------------------------------------------------------------

export const FEE_RULES = {
  full: {
    LOWER: {
      physician: { early: 75, late: 100 },
      'non-physician': { early: 25, late: 40 }
    },
    UPPER: {
      physician: { early: 200, late: 225 },
      'non-physician': { early: 75, late: 100 }
    },
    LOCAL: {
      physician: { early: 30, late: 80 },
      'non-physician': { early: 20, late: 40 }
    }
  },
  rehab: {
    ALL: { early: 15, late: 40 }
  }
};

// ---------------------------------------------------------------------------
// PERIOD & INCOME LOGIC (same as original JS)
// ---------------------------------------------------------------------------

function getFeePeriod(): 'early' | 'late' {
  const today = new Date();
  const earlyEnd = new Date('2026-08-31');
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
    return FEE_RULES.rehab.ALL[period as 'early' | 'late'];
  }

  const groupFees = (FEE_RULES.full as any)[incomeGroup];
  if (!groupFees) return null;

  const catFees = groupFees[participantCategory as 'physician' | 'non-physician'];
  if (!catFees) return null;

  return catFees[period];
}



@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
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
  successVisible = false;
  registrationCardHidden = false;
  successDetails = '';

  // Error messages mapped by field name (matches data-error-for)
  errorMessages: Record<string, string> = {};

  // Country list for dropdown
  countries: string[] = [];

  // Modal visibility
  showDataUseModal = false;
  showTermsModal = false;
  showCancellationModal = false;

  private apiUrl = environment.apiUrl;

  countryCodes = signal<any[]>([]);
  countryCode: string = '';
  mobileExample: string = '+94 71 234 5678';


  async ngOnInit(): Promise<void> {
    // Build sorted country list
    this.countries = Object.keys(COUNTRY_INCOME_GROUPS).sort();

    // Initialise period texts & badge (same logic as original)
    this.currentPeriod = getFeePeriod();
    this.feePeriodBadgeText =
      this.currentPeriod === 'early'
        ? 'EARLY BIRD (1 Mar – 31 Aug 2026)'
        : 'LATE (1 Sep – 28 Nov 2026)';

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
    } catch (err) {
      console.error('Failed to fetch country codes', err);
    }
  }

  // -----------------------------------------------------------------------
  // Event handlers (replacing addEventListener / change handlers)
  // -----------------------------------------------------------------------

  onCountryChange(): void {
    this.updateFeeSummary();
  }

  onParticipantCategoryChange(): void {
    this.updateFeeSummary();
  }

  onConferenceTypeChange(): void {
    this.updateFeeSummary();
  }

  // -----------------------------------------------------------------------
  // Fee summary & conference type
  // -----------------------------------------------------------------------

  private getSelectedConferenceType(): string | null {
    return this.conferenceType;
  }

  private updateFeeSummary(): void {
    const country = this.country;
    const participantCategory = this.participantCategory;
    const conferenceType = this.getSelectedConferenceType();
    const group = country ? determineIncomeGroup(country) : null;

    if (!country || !participantCategory || !conferenceType || !group) {
      this.feeAmountDisplay =
        'Select your country, category, and participation type to see the fee.';
      this.feeAmount = null;
      this.incomeGroup = null;
      return;
    }

    const fee = calculateFee({
      conferenceType,
      participantCategory,
      incomeGroup: group,
      date: new Date()
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

  // -----------------------------------------------------------------------
  // Modal controls (replacing data-open-modal & data-close-modal)
  // -----------------------------------------------------------------------

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
    // Match original behavior: close only if background clicked
    if (event.target === event.currentTarget) {
      this.closeModal(which);
    }
  }

  // -----------------------------------------------------------------------
  // Validation logic (ported from vanilla JS)
  // -----------------------------------------------------------------------

  private setError(name: string, message: string | null): void {
    this.errorMessages = {
      ...this.errorMessages,
      [name]: message || ''
    };
  }

  private clearAllErrors(): void {
    this.errorMessages = {};
  }

  private validateForm(): boolean {
    this.clearAllErrors();
    let valid = true;

    const requiredFields = [
      'title',
      'firstName',
      'lastName',
      'designation',
      'institution',
      'country',
      'email',
      'mobile',
      'participantCategory'
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
        case 'institution':
          return this.institution;
        case 'country':
          return this.country;
        case 'email':
          return this.email;
        case 'mobile':
          return this.mobile;
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

    // Email format
    const emailValue = (this.email || '').trim();
    if (emailValue && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailValue)) {
      this.setError('email', 'Please enter a valid email address.');
      valid = false;
    }

    // Conference type
    if (!this.getSelectedConferenceType()) {
      this.setError('conferenceType', 'Please select a participation option.');
      valid = false;
    }

    // Fee must be determined
    if (this.feeAmount == null) {
      this.setError('conferenceType', 'Fee could not be determined.');
      valid = false;
    }

    // Consent checkboxes
    if (!this.consentDataUse || !this.consentTerms) {
      this.setError('consent', 'Please accept all required consents.');
      valid = false;
    }

    return valid;
  }

  // -----------------------------------------------------------------------
  // Submit logic (ported from original submit handler)
  // -----------------------------------------------------------------------

  async onSubmit(): Promise<void> {
    this.formStatus = '';

    if (!this.validateForm()) {
      this.formStatus = 'Please fix the highlighted errors.';
      return;
    }

    const payload = this.buildPayloadFromForm();

    try {
      this.formStatus = 'Submitting registration...';

      const res = await fetch(`${this.apiUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit registration.');
      }

      const data = await res.json();

      this.formStatus = '';
      this.successVisible = true;
      this.registrationCardHidden = true;

      const feeText =
        typeof data.feeAmount === 'number'
          ? data.feeAmount.toFixed(2)
          : this.feeAmount !== null
            ? this.feeAmount.toFixed(2)
            : 'N/A';

      this.successDetails = `Your registration ID is ${data.registrationId
        }. Total fee: USD ${feeText}. Payment status: ${data.paymentStatus}.`;
    } catch (error: any) {
      console.error(error);
      this.formStatus = error?.message || 'Failed to submit registration.';
    }
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
      mobile: `${this.countryCode}${this.mobile}`,
      participantCategory: this.participantCategory,
      conferenceType,
      feeAmountClient: this.feeAmount !== null ? Number(this.feeAmount) : null,
      incomeGroup: this.incomeGroup || null,
      consentDataUse: this.consentDataUse,
      consentTerms: this.consentTerms
    };
  }
}
