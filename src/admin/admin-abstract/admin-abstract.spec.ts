import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAbstract } from './admin-abstract';

describe('AdminAbstract', () => {
  let component: AdminAbstract;
  let fixture: ComponentFixture<AdminAbstract>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAbstract]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminAbstract);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
