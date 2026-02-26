import { Injectable } from '@angular/core';
import { Ability } from '@casl/ability';

@Injectable({ providedIn: 'root' })
export class AbilityService {
  ability = new Ability<any>([]);

  update(rules: any[]) {
    this.ability.update(rules);
  }
}