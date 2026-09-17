import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminRegistration } from './admin-registration';

describe('AdminRegistration', () => {
  let component: AdminRegistration;
  let fixture: ComponentFixture<AdminRegistration>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRegistration],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRegistration);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
