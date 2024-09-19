import { ChangeDetectorRef, Component, OnInit, AfterViewInit } from '@angular/core';
import { H_Yard } from 'helyosjs-sdk';
import { HelyosService } from '../../services/helyos.service';
import { H_MapObject } from 'helyosjs-sdk/dist/helyos.models';

@Component({
  selector: 'app-yardmap',
  templateUrl: './yardmap.component.html',
  styleUrls: ['./yardmap.component.scss'],
})
export class YardmapComponent implements OnInit, AfterViewInit {
  public yardmap: H_Yard[];
  public selectedItem: H_Yard;
  public selectedObjectItem: H_MapObject;
  public mapObjects: H_MapObject[];

  public filterObj: Partial<H_MapObject> = {};
  public first: number = 15;
  public page: number = 1;
  public filterType: string;

  public otherDataFormat: string;
  public disableUploadButton: boolean = false;

  public loadingShape: boolean = false;
  public mapObjDataInput: string;

  private filterTextTimeout: NodeJS.Timeout;

  constructor(private helyosService: HelyosService, private changeDetector: ChangeDetectorRef) { }

  ngOnInit() {
    this.listYards();
  }

  ngAfterViewInit() {
    this.listYards();
  }

  listYards() {
    return this.helyosService.methods.yard.list({})
      .then(r => {
        this.yardmap = r;
      });
  }

  getYardItem(itemId) {
    return this.helyosService.methods.yard.get(itemId)
      .then((r: H_Yard) => {
        this.selectedItem = r;
        this.page = 1;
        return this.filterObjList(0);
      });
  }

  changeDataFormat(_ev) {
  }

  debouncingFilterText(event) {
    // wait until user finish the typing to filter
    if (this.filterTextTimeout) {
      clearTimeout(this.filterTextTimeout);
    }
    this.filterTextTimeout = setTimeout(() => {
      this.filterType = event.target.value;
      this.page = 1;
      this.filterObjList(0);
    }, 500);

  }

  filterObjList(pageDelta: number = 0) {
    this.page += pageDelta;
    if (this.page < 1) {
      this.page = 1;
    }
    this.filterObj = {};
    const offset = (this.page - 1) * this.first;
    const filter = {
      yardId: this.selectedItem.id,
      deletedAt: null,
      ...this.filterObj,
    };
    if (this.filterType) {
      filter['type'] = this.filterType;
    }
    return this.helyosService.methods.mapObjects.list(filter, this.first, offset)
      .then((mapObjects) => {
        this.mapObjects = mapObjects;
        this.mapObjects.forEach(o => {
          if (o.data) {
            o.data = JSON.stringify(o.data, null, 3);
          }
          if (o.metadata) {
            o.metadata = JSON.stringify(o.metadata, null, 3);
          }
        });
      });

  }

  getObjectItem(itemId) {
    if (this.selectedObjectItem && this.selectedObjectItem.id === itemId) {
      return;
    }

    this.helyosService.methods.mapObjects.get(itemId)
      .then((o: H_MapObject) => {
        this.selectedObjectItem = o;
        if (o.data) {
          o.data = JSON.stringify(o.data, null, 3);
        }
        if (o.metadata) {
          o.metadata = JSON.stringify(o.metadata, null, 3);
        }

      });
  }

  addObjectItem() {
    const newItem = new H_MapObject();
    newItem.yardId = this.selectedItem.id;
    this.helyosService.methods.mapObjects.create(newItem)
      .then((r) => {
        this.selectedObjectItem = r;
        this.getYardItem(this.selectedItem.id);
      });
  }

  deleteObjectItem(itemId) {
    this.helyosService.methods.mapObjects.delete(itemId)
      .then(() => {
        this.selectedObjectItem = null;
        this.getYardItem(this.selectedItem.id);
      });
  }

  saveObjectItem(_itemId) {
    const patch = {
      ...this.selectedObjectItem,
    };
    delete patch.createdAt;
    delete patch.modifiedAt;
    try {
      if (patch.data) {
        patch.data = JSON.parse(patch.data);
      }
    } catch (error) {
      alert('Data is no a valid JSON');
      return 0;
    }
    try {
      if (patch.metadata) {
        patch.metadata = JSON.parse(patch.metadata);
      }
    } catch (error) {
      alert('Metadata is no a valid JSON');
      return 0;
    }

    this.helyosService.methods.mapObjects.patch(this.selectedObjectItem)
      .then(() => {
        this.selectedObjectItem = null;
        this.getYardItem(this.selectedItem.id);
      });
  }

  saveShapeData(mapObjData) {
    const newShapes = mapObjData.map((data) => {
      const newItem = new H_MapObject();
      if (data && data.geometry_type && typeof data.geometry_type === 'string') {
        newItem.data.geometry_type = data.geometry_type;
      }
      newItem.data = data;
      newItem['dataFormat'] = this.selectedItem.dataFormat;
      newItem.yardId = this.selectedItem.id;
      return newItem;
    });

    return this.helyosService.methods.mapObjects.markAllDeleted(this.selectedItem.id)
      .then(() => {
        const promisses = newShapes.map(s => this.helyosService.methods.mapObjects.create(s));
        return Promise.all(promisses).then((_) => alert('map shapes saved.'));
      })
      .catch((err) => alert(JSON.stringify(err)));
  }

  async downloadYardData() {
    const mapObjects = await this.helyosService.methods.mapObjects.list({
      yardId: this.selectedItem.id,
      deletedAt: null,
    }, 1e9);
    const origin = {
      lat: this.selectedItem.lat,
      lon: this.selectedItem.lon,
      alt: this.selectedItem.alt,
    };
    const dataFormat = this.selectedItem.dataFormat;
    const id = this.selectedItem.id;
    alert(`${mapObjects.length} objects to download`);
    this.downloadObject(JSON.stringify({
      id,
      mapObjects,
      origin,
      dataFormat,
    }, undefined, 4), `${this.selectedItem.name}.json`, 'application/json');

  }

  downloadObject(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], {
      type: contentType,
    });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  }

  browserYardShapes() {
    const uploadBtn = document.getElementById('fileup');
    uploadBtn.click();

  }

  onFileChanged(event) {
    this.disableUploadButton = true;
    const selectedFile = event.target.files[0];
    event.target.value = '';
    const fileReader = new FileReader();
    fileReader.readAsText(selectedFile, "UTF-8");
    fileReader.onload = () => {
      this.overwriteYardShapes(JSON.parse(fileReader.result as string));
    };
    fileReader.onerror = (error) => {
      this.disableUploadButton = false;
      console.log(error);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overwriteYardShapes(yardData: H_MapObject[] | any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapObjects: any;

    if (Array.isArray(yardData)) {
      mapObjects = yardData;
    }
    if (Array.isArray(yardData['mapObjects'])) {
      mapObjects = yardData['mapObjects'];
    }
    if (Array.isArray(yardData['map_objects'])) {
      mapObjects = yardData['map_objects'];
    }

    if (!(mapObjects && mapObjects.length)) {
      alert('No map objects in file');
      this.disableUploadButton = false;
      return;
    }

    const _shapes = mapObjects.map(sh => {
      sh.yardId = this.selectedItem.id;
      sh.type = sh.type ? sh.type : 'obstacle';
      return sh;
    });

    if (yardData.origin) {
      if (confirm('This file contains new reference coordinates for the yard. Are you sure you want to update them?')) {
        const patch: Partial<H_Yard> = {
          id: this.selectedItem.id,
          lat: yardData.origin.lat,
          lon: yardData.origin.lon,
          alt: yardData.alt,
        };
        if (yardData.mapData) {
          patch.mapData = yardData.mapData;
        }
        this.helyosService.methods.yard.patch(patch)
          .then(() => {
            this.listYards(); Object.assign(this.selectedItem, patch);
          });
      }
    }

    if (confirm('Are you sure you want to overwrite all current objects?')) {
      this.helyosService.methods.mapObjects.markAllDeleted(this.selectedItem.id)
        .then(() => this.helyosService.methods.mapObjects.createMany(_shapes))
        .then(() => {
          this.filterObjList(0)
            .finally(() => this.disableUploadButton = false);
        })
        .finally(() => this.disableUploadButton = false);
    }

  }

  openDocs() {
    window.open('https://helyos-manual.readthedocs.io/en/latest/1-the-helyos-framework/data-formats.html#yard-and-map-formats', '_blank');
  }

}

