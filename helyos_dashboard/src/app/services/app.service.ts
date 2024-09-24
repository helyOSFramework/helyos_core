import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AppService {

  constructor() {
  }

  enableTooltips(): any[] {
    const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map((tooltipTriggerEl) => {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    return tooltipList;
  }

  hideAllTooltips(tooltipList: any[]) {
    for (const tooltip of tooltipList) {
      tooltip.dispose();
    }
  }
}
