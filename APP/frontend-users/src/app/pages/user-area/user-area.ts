import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user';
import { AbilityService } from '../../services/ability';

@Component({
  selector: 'app-user-area',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-area.html'
})
export class UserAreaComponent implements OnInit {
  users: any[] = [];

  constructor(
    private userService: UserService,
    public abilityService: AbilityService
  ) {}

  ngOnInit() {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  goToAdminPanel() {
    window.location.href = 'http://localhost:4200';
  }
}