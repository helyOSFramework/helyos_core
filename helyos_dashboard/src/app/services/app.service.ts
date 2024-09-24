import { Injectable } from '@angular/core';

declare var bootstrap: any;

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private tooltipList = new Array<any>();

  constructor() {
  }

  enableTooltip() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipListNewTooltips = tooltipTriggerList.map(tooltipTriggerEl => {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    console.log(tooltipListNewTooltips);
    this.tooltipList.push(...tooltipListNewTooltips);
  }

  hideAllTooltips() {
    for (const tooltip of this.tooltipList) {
      tooltip.dispose();
    }
    this.tooltipList = new Array<any>();
  }
}
