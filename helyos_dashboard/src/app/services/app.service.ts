import { Injectable } from '@angular/core';
import * as bootstrap from 'bootstrap';

@Injectable({
  providedIn: 'root',
})
export class AppService {

  constructor() {
  }

  enableTooltips(): bootstrap.Tooltip[] {
    const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map((tooltipTriggerEl) => {
      return new bootstrap.Tooltip(tooltipTriggerEl, {
        trigger: 'hover',
      });
    });
    return tooltipList;
  }

  hideAllTooltips(tooltipList: bootstrap.Tooltip[]) {
    for (const tooltip of tooltipList) {
      tooltip.dispose();
    }
  }
}
