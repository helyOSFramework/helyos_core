import { Component, OnInit } from '@angular/core';
import { H_WorkProcessType } from 'helyosjs-sdk';
import { HelyosService } from '../../services/helyos.service';
import { exportToYML, importFromYML } from './read_config_yml';


@Component({
  selector: 'app-work-processes',
  templateUrl: './work-processes.component.html',
  styleUrls: ['./work-processes.component.scss']
})
export class WorkProcessesComponent implements OnInit {
  public wpTypes: H_WorkProcessType[];
  public selectedItem: H_WorkProcessType;
  public showDescription: boolean = false;
  public availableMissions: string[] = [];


  constructor(private helyosService: HelyosService) {
  }


  ngOnInit() {
    this.list();
  }


  list() {
    return this.helyosService.methods.workProcessType.list({})
      .then(r => {
        this.wpTypes = r;
        this.availableMissions = r.map(wp => wp.name);
      });
  }


  create() {
    const newItem = { name: 'Unnamed' };
    this.helyosService.methods.workProcessType.create(newItem)
      .then(r => {
        console.log(r);
        this.list().then(() => this.getItem(r.id));

      });
  }

  getItem(itemId) {
    this.helyosService.methods.workProcessType.get(itemId)
      .then(r => {
        this.selectedItem = r;
        if (!r.settings) { r.settings = {}; }
        this.selectedItem.settings = JSON.stringify(r.settings, null, 2);
      });
  }


  deleteItem() {
    if (this.selectedItem) {
      this.helyosService.methods.workProcessType.delete(this.selectedItem.id as string)
        .then((_) => {
          this.list();
        });
    }
  }

  editItem(item) {
    const patch = { ...item };
    delete patch.createdAt;
    delete patch.modifiedAt;

    try {
      patch.settings = JSON.parse(patch.settings);
    } catch (error) {
      alert('Settings is no a valid JSON');
      return;
    }

    this.helyosService.methods.workProcessType.patch(patch)
      .then((_) => {
        this.list();
        alert('changes saved');
      });
  }


  browserYardShapes() {
    const uploadBtn = document.getElementById('fileup');
    uploadBtn.click();

  }


  importYML(event) {
    const selectedFile = event.target.files[0];
    const reader = new FileReader();
    reader.readAsText(selectedFile, "UTF-8");

    reader.onload = (_) => {
      // convert yml to DB data and save it.
      const data = reader.result as string;
      importFromYML(data, this.helyosService.methods.workProcessType, this.helyosService.methods.workProcessServicePlan)
        .then(() => {
          this.list();
          alert('changes saved');
        });
    };
  }

  exportYML() {
    // convert DB data to yml
    exportToYML(this.helyosService.methods.workProcessType, this.helyosService.methods.workProcessServicePlan)
      .then(ymlData => {
        this.downloadObject(ymlData, 'missions.yml', 'application/x-yaml');
      });
  }

  downloadObject(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  }


}
