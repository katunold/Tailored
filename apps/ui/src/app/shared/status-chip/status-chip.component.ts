import { Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { NgClass } from '@angular/common';
import { OrderStatus } from '../status/status.types';

@Component({
  selector: 'app-status-chip',
  imports: [MatChipsModule, NgClass],
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.scss'
})
export class StatusChipComponent {
  readonly status = input<OrderStatus>('New');
}
