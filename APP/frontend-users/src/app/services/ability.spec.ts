import { TestBed } from '@angular/core/testing';

import { Ability } from './ability';

describe('Ability', () => {
  let service: Ability;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Ability);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
