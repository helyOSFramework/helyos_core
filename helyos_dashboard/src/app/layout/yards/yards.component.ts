import { Component, OnInit } from '@angular/core';
import { H_Yard } from 'helyosjs-sdk';
import { HelyosService } from '../../services/helyos.service';

@Component({
  selector: 'app-yards',
  templateUrl: './yards.component.html',
  styleUrls: ['./yards.component.scss'],
})
export class YardsComponent implements OnInit {
  public yards: H_Yard[];
  public selectedItem: H_Yard;

  constructor(private helyosService: HelyosService) {

  }

  ngOnInit() {
    this.list();
  }

  list() {
    return this.helyosService.methods.yard.list({})
      .then(r => {
        this.yards = r.map(yard => {
          try {
            yard.mapData = JSON.stringify(yard.mapData, null, 2);
          } catch (error) {
            yard.mapData = '';
          }
          return yard;
        });
      });
  }

  create() {
    const newItem = {
      name: 'Unnamed',
      source: 'manual input',
    };
    this.helyosService.methods.yard.create(newItem)
      .then(r => {
        console.log(r);
        this.list().then(() => this.getItem(r.id));

      });
  }

  getItem(itemId) {
    this.helyosService.methods.yard.get(itemId)
      .then((r: H_Yard) => {
        this.selectedItem = r;
        try {
          this.selectedItem.mapData = JSON.stringify(this.selectedItem.mapData, null, 2);
        } catch (error) {
          this.selectedItem.mapData = '';
        }
      });
  }

  deleteItem(itemId) {
    this.helyosService.methods.yard.delete(itemId)
      .then(r => {
        if (r.message) {
          const message = r.message;
          alert(message);
        } else {
          this.list();
        }
      });

  }

  editItem(item) {
    const patch = {
      ...item,
    };
    delete patch.createdAt;
    delete patch.modifiedAt;
    delete patch._customCoordinateFrame;

    try {
      patch.mapData = JSON.parse(patch.mapData);
    } catch (error) {
      alert('Map Info is no a valid JSON');
      return;
    }

    if (item._customCoordinateFrame){
      patch.coordinateFrame = item._customCoordinateFrame;
    }

    this.helyosService.methods.yard.patch(patch)
      .then(r => {
        if (r.message) {
          const message = r.message;
          alert(message);
        } else {
          this.list();
          alert('changes saved');
        }

      });
  }

  openDocs() {
    window.open('https://helyos-manual.readthedocs.io/en/latest/1-the-helyos-framework/data-formats.html#yard-and-map-formats', '_blank');
  }

}
