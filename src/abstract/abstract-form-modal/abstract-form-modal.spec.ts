import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbstractFormModal } from './abstract-form-modal';

describe('AbstractFormModal', () => {
  let component: AbstractFormModal;
  let fixture: ComponentFixture<AbstractFormModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbstractFormModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AbstractFormModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
