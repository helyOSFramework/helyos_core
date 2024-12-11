import { Component, OnInit } from '@angular/core';
import { H_Service } from 'helyosjs-sdk';
import { HelyosService } from '../../services/helyos.service';
import { downloadObject, yamlDump } from 'src/app/shared/utilities';

@Component({
  selector: 'app-all-services',
  templateUrl: './all-services.component.html',
  styleUrls: ['./all-services.component.scss'],
})
export class AllServicesComponent implements OnInit {
  public services: H_Service[];
  public selectedItem: H_Service;
  public showDescription: boolean = false;
  public requireMapObjectsInput: string;

  constructor(private helyosService: HelyosService) {

  }

  ngOnInit() {
    this.list();
  }

  list() {
    return this.helyosService.methods.extServices.list({})
      .then(r => {
        this.services = r;
        return this.services;
      });
  }

  create() {
    const newItem = {
      name: 'Unnamed',
    };
    this.helyosService.methods.extServices.create(newItem)
      .then(r => {
        console.log(r);
        this.list().then(() => this.getItem(r.id));

      });
  }

  getItem(itemId) {
    this.helyosService.methods.extServices.get(itemId)
      .then(r => {
        this.selectedItem = r;
        this.requireMapObjectsInput = r.requireMapObjects.join(', ');

      });
  }

  delete(itemId) {
    if (confirm('Are you sure you want to delete?')) {
      this.helyosService.methods.extServices.delete(itemId)
        .then((_) => this.list());
    }
  }

  editItem(item) {
    const patch = {
      ...item,
    };
    delete patch.createdAt;
    delete patch.modifiedAt;
    delete patch.requireMapObjects;

    if (!this.requireMapObjectsInput) {
      patch['requireMapObjects'] = [];
    } else {
      try {
        const jsonArray = this.requireMapObjectsInput.split(',').map(element => element.trim());
        patch['requireMapObjects'] = jsonArray;
      } catch (error) {
        alert('error: requireMapObjects must be an array of strings.');
        return;
      }
    }

    this.helyosService.methods.extServices.patch(patch)
      .then((_) => {
        this.list();
        alert('changes saved');
      });
  }

  openMapAPIDoc() {
    window.open('/api-docs/map_api.html', '_blank');
  }

  openPPAPIDoc() {
    window.open('/api-docs/path_api.html', '_blank');
  }

  toggleEnable(item) {
    return this.helyosService.methods.extServices.patch({
      id: item.id,
      enabled: !item.enabled,
    })
      .then((_) => {
        item.enabled = !item.enabled;
        this.list();
      });
  }

  exportYML() {
    if (!this.services) {
      alert('No Microservices Found');
      return;
    }
    this.parseServices()
      .then((services) => {
        const dataJSON = {
          'version': '2.0',
          'services': services,
        };
        let ymlData = yamlDump(dataJSON);
        ymlData = ymlData
          .replace(/(\n\s{2}\w+:)/g, '\n\n$1'); // 2 line spaces before service name at 2 spaces indentation

        downloadObject(ymlData, 'microservices.yml', 'application/x-yaml');
      });
  }

  private async parseServices() {
    const ymlJsonIndent = 2;
    const servicesToYmlMap = {
      serviceType: 'type',
      serviceUrl: 'url',
      licenceKey: 'apikey',
      class: 'domain',
      isDummy: 'is_dummy',
      enabled: 'enable',
      resultTimeout: 'timeout',
      config: 'config',
      requireMapData: 'context.map_data',
      requireMissionAgentsData: 'context.mission_agents_data',
      requireAgentsData: 'context.all_agents_data',
      requireMapObjects: 'context.require_map_objects',
      description: 'description',
    };

    const services = {};
    const servicesDetails = await this.fetchServicesInParallel();

    servicesDetails.forEach((service) => {
      const mappedItem = {};
      const serviceName = service["name"];

      for (const [jsonKey, yamlKey] of Object.entries(servicesToYmlMap)) {
        const value = service[jsonKey];
        if (yamlKey.includes('.')) {
          // Handle nested context mappings
          const [mainKey, subKey] = yamlKey.split('.');
          mappedItem[mainKey] = mappedItem[mainKey] || {}; // if mainKey not present, initialize it
          mappedItem[mainKey][subKey] = value;
        } else {
          mappedItem[yamlKey] = value;
        }
      }

      const config = JSON.parse(mappedItem["config"]);
      mappedItem["config"] = JSON.stringify(config, null, ymlJsonIndent);

      services[serviceName] = mappedItem;
    });
    return services;
  }

  private async fetchServicesInParallel() {
    try {
      // Create an array of promises for each service request
      const servicePromises = this.services.map((service) =>
        this.helyosService.methods.extServices.get(service.id)
      );
      const results = await Promise.all(servicePromises);

      return results;
    } catch (error) {
      console.error('Error fetching services details:', error);
      return [];
    }
  }
}
