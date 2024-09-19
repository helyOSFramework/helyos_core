import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-stat',
  templateUrl: './stat.component.html',
  styleUrls: ['./stat.component.scss'],
})
export class StatComponent {
  @Input() bgClass: string;
  @Input() icon: string;
  @Input() count: number;
  @Input() label: string;
  @Input() data: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Output() event: EventEmitter<any> = new EventEmitter();

  constructor() { }

}
