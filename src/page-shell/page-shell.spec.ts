import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageShell } from './page-shell';

describe('PageShell', () => {
  let component: PageShell;
  let fixture: ComponentFixture<PageShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageShell]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
