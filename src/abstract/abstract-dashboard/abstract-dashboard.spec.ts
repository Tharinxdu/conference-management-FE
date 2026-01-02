import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbstractDashboard } from './abstract-dashboard';

describe('AbstractDashboard', () => {
  let component: AbstractDashboard;
  let fixture: ComponentFixture<AbstractDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbstractDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AbstractDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
