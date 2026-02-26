import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserArea } from './user-area';

describe('UserArea', () => {
  let component: UserArea;
  let fixture: ComponentFixture<UserArea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserArea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserArea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
