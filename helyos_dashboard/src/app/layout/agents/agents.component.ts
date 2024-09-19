import { Component, OnDestroy, OnInit } from '@angular/core';
import { H_Agent } from 'helyosjs-sdk';
import { ModalDismissReasons, NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { HelyosService } from '../../services/helyos.service';

interface ISensor { }

interface IPatch { }

class AgentModel extends H_Agent {
  _iterSensors: ISensor[];
}

@Component({
  selector: 'app-agents',
  templateUrl: './agents.component.html',
  styleUrls: ['./agents.component.scss'],
})
export class AgentsComponent implements OnInit, OnDestroy {
  public agents: H_Agent[];
  public modalOptions: NgbModalOptions;
  closeResult: string;
  public example: string;
  public seeRaw: boolean = false;

  constructor(private helyosService: HelyosService, private modalService: NgbModal) {

    this.modalOptions = {
      backdrop: false,
      backdropClass: 'customBackdrop',

    };
    this.example = this.getExample();

  }

  ngOnInit() {
    const socket = this.helyosService.methods.socket;

    this.helyosService.methods.agents.list({}, 1e6, 0, 'CONNECTION_STATUS_DESC')
      .then(r => {
        this.agents = r;
        this.appendSensorFormatToPatchObject(this.agents);
      });

    socket.on('new_agent_poses', (updates: IPatch[]) => {
      updates = this.appendSensorFormatToPatchObject(updates);
      this.updateItems(updates, this.agents);
    });

    socket.on('change_agent_status', (updates: IPatch[]) => {
      this.updateItems(updates, this.agents);

    });
  }


  ngOnDestroy(): void {
    const socket = this.helyosService.methods.socket;
    socket.removeAllListeners('change_agent_status');
    socket.removeAllListeners('new_agent_poses');
  }

  updateItems(updates, listItems) {
    updates.forEach(patch => {
      const toolId = patch.toolId ? patch.toolId : patch.id;
      const item: AgentModel = listItems ? listItems.find(e => e.id.toString() === toolId.toString()) : null;

      if (item) {
        for (const key in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, key)) {
            if (key !== "id" && key !== "toolId") {
              item[key] = patch[key];
            }
          }
        }
      }

    });
  }


  getSensorsMeasures(sensorSet) {
    const sensorArray = [];


    for (const key in sensorSet) {
      try {
        const item = {
          title: sensorSet[key].title,
          value: sensorSet[key].value,
          type: sensorSet[key].type,
          maximum: sensorSet[key].maximum,
          minimum: sensorSet[key].minimum,
          key: key,
          unit: sensorSet[key].unit,
        };

        if (item.maximum) {
          try {
            item['perc'] = Math.round(item.value / item.maximum * 10000) / 100;
            item['progressBar'] = Math.round(100 * ((item.value / item.maximum))).toString() + '%';
          } catch (error) {
            item['perc'] = null;
          }
        }
        sensorArray.push(item);
      } catch (error) {
        console.log(error, sensorSet);
      }
    }

    return sensorArray;
  }



  appendSensorFormatToPatchObject(updates) {
    // This function modifies the input parameter for better performance.
    updates.forEach(patch => {
      if (patch.sensors) {
        const iterSensorSets: { name: string; sensors: ISensor[]; }[] = [];
        for (const key in patch.sensors) {
          const iterSensorSet: ISensor[] = this.getSensorsMeasures(patch.sensors[key]);
          iterSensorSets.push({
            name: key,
            sensors: iterSensorSet, 
          });
        }
        patch._iterSensors = iterSensorSets;

        patch._sensorString = JSON.stringify(patch.sensors, null, 4);
      }
    });

    return (updates);
  }




  convertToPercent(value, key) {
    let max = 1;
    if (key === "battery") {
      max = 100;
    }
    return Math.round(100 * ((value / max) - 0.7)).toString() + '%';
  }


  openAPIDoc() {
    window.open('https://app.swaggerhub.com/apis-docs/helyOS/helyos_agent_comm/2.0.7#/SensorSet', '_blank');

  }



  open(content) {
    this.modalService.open(content, this.modalOptions).result.then((result) => {
      this.closeResult = `Closed with: ${result}`;
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  private getDismissReason(reason: ModalDismissReasons | string): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }



  getExample() {
    const example = {
      "sensor_set_1": {
        "bat_1": {
          title: "Battery level",
          value: 45,
          type: "number",
          description: "battery used for backlight system",
          unit: "%",
          minimum: 0,
          maximum: 100,
        },

        "bat_2": {
          title: "Main power",
          value: 59,
          type: "number",
          description: "battery used for truck engine",
          unit: "%",
          minimum: 0,
          maximum: 100,
        },
      },
      "sensor_set_2": {

        "velocity": {
          title: "velocity",
          value: 20,
          type: "number",
          unit: "km/h",
          minimum: 0,
          maximum: 200,
        },

        "back_door_status": {
          title: "Truck door status",
          value: "half-open",
          type: "string",
          unit: "km/h",
          minLength: 5,
          maxLength: 10,
        },
      },
    };


    return JSON.stringify(example, null, 5);

  }

}
