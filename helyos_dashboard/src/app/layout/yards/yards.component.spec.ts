import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { YardsComponent } from './yards.component';

describe('YardsComponent', () => {
  let component: YardsComponent;
  let fixture: ComponentFixture<YardsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [YardsComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(YardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
