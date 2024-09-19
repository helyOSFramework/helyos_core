import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutComponent } from './layout.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'all-services', pathMatch: 'prefix' },
      { path: 'dashboard', redirectTo: 'all-services', pathMatch: 'prefix' },

      {
        path: 'blank-page',
        loadChildren: () => import('./blank-page/blank-page.module').then((m) => m.BlankPageModule),
      },
      {
        path: 'work-processes',
        loadChildren: () => import('./work-processes/work-processes.module').then((m) => m.WorkProcessesModule),
      },

      {
        path: 'work-processes/:id',
        loadChildren: () => import('./work-process-services/work-process-services.module').then((m) => m.WorkProcessServicesModule),
      },

      {
        path: 'all-services',
        loadChildren: () => import('./all-services/all-services.module').then((m) => m.AllServicesModule),
      },
      {
        path: 'agents',
        loadChildren: () => import('./agents/agents.module').then((m) => m.AgentsModule),
      },
      {
        path: 'agent-assignments',
        loadChildren: () => import('./agent-assignments/agent-assignments.module').then((m) => m.AgentAssignmentsModule),
      },
      {
        path: 'accounts',
        loadChildren: () => import('./accounts/accounts.module').then((m) => m.AccountsModule),
      },
      {
        path: 'yards',
        loadChildren: () => import('./yards/yards.module').then((m) => m.YardsModule),
      },
      {
        path: 'yardmap',
        loadChildren: () => import('./yard_map/yardmap.module').then((m) => m.YardmapModule),
      },
      {
        path: 'dispatch-processes',
        loadChildren: () => import('./dispatch-processes/dispatch-processes.module').then((m) => m.DispatchProcessesModule),
      },
      {
        path: 'run-lists',
        loadChildren: () => import('./run-lists/mission-queues.module').then((m) => m.RunListsModule),
      },
      {
        path: 'dispatch-services',
        loadChildren: () => import('./dispatch-services/dispatch-services.module').then((m) => m.DispatchServicesModule),
      },
      {
        path: 'agents-registry',
        loadChildren: () => import('./agent-regist/agent-regist.module').then((m) => m.AgentRegistModule),
      },
      {
        path: 'vehicles-registry',
        loadChildren: () => import('./agent-vehicles/agent-vehicles.module').then((m) => m.AgentVehiclesModule),
      },
      {
        path: 'tools-registry',
        loadChildren: () => import('./agent-tools/agent-tools.module').then((m) => m.AgentToolsModule),
      },
      {
        path: 'chargeStations-registry',
        loadChildren: () => import('./agent-chargeStations/agent-chargeStations.module').then((m) => m.AgentChargeStationsModule),
      },
      {
        path: 'assistants-registry',
        loadChildren: () => import('./agent-assistants/agent-assistants.module').then((m) => m.AgentAssistantsModule),
      },
      {
        path: 'system-log',
        loadChildren: () => import('./system-log/system-log.module').then((m) => m.SystemLogModule),
      },

    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LayoutRoutingModule { }
