import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RunListsComponent } from './mission-queues.component';

describe('RunListsComponent', () => {
    let component: RunListsComponent;
    let fixture: ComponentFixture<RunListsComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [RunListsComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(RunListsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
