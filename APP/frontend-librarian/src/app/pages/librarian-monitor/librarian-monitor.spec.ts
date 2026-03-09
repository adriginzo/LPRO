import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibrarianMonitor } from './librarian-monitor';

describe('LibrarianMonitor', () => {
  let component: LibrarianMonitor;
  let fixture: ComponentFixture<LibrarianMonitor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibrarianMonitor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LibrarianMonitor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
