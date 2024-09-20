import { Component, OnInit } from '@angular/core';
import { H_Agent, H_AgentInterconnection, H_InstantAction } from 'helyosjs-sdk';
import { HelyosService } from '../../services/helyos.service';
import { AgentClass } from 'helyosjs-sdk/dist/helyos.models';

@Component({
  selector: 'app-agent-vehicles',
  templateUrl: './agent-vehicles.component.html',
  styleUrls: ['./agent-vehicles.component.scss'],
})
export class AgentVehiclesComponent implements OnInit {
  public tools: H_Agent[];
  public selectedItem: H_Agent;
  public interconnections: H_AgentInterconnection[];
  public instantActionCommand: string;
  private rbmqAccountChange: boolean = false;
  public rbmqPassword = '';
  public active = 1;
  public showOthers = false;
  private agentClass: AgentClass = AgentClass.Vehicle;
  public saveStateMsg: string = '';

  constructor(private helyosService: HelyosService) {

  }

  ngOnInit() {
    this.list();
  }

  list() {
    return this.helyosService.methods.agents.list({
      agentClass: this.agentClass,
    })
      .then(r => {
        this.tools = r;
        return this.tools;
      });
  }

  changeRegistration() {
    if (!this.selectedItem.allowAnonymousCheckin && !this.selectedItem.rbmqUsername) {
      this.selectedItem.rbmqUsername = this.selectedItem.uuid;
    }
  }

  changeProtocol() {
    if (this.selectedItem.protocol === 'MQTT') {
      this.selectedItem.allowAnonymousCheckin = false;
    }
  }

  updateRabbitMQ() {

    if (!this.selectedItem.allowAnonymousCheckin && this.rbmqAccountChange) {

      this.helyosService.methods.agents.createRabbitMQAgent(Number(this.selectedItem.id),
        this.selectedItem.rbmqUsername,
        this.rbmqPassword)
        .then((r) => {
          if (r.errors) {
            alert(JSON.stringify(r.errors));
          } else {
            alert('RabbitMQ account created or updated.');
          }
        });
    }
    this.rbmqAccountChange = false;
    this.rbmqPassword = '';
  }

  create() {
    // const newItem={name:'Unnamed', yardId: 1, status:'checked out', agentClass:this.agentClass, allowAnonymousCheckin:false}
    const newItem = new H_Agent(this.agentClass);
    this.helyosService.methods.agents.create(newItem)
      .then(r => {
        console.log(r);
        this.list().then(() => this.getItem(r.id));

      });
  }

  sendInstantAction() {
    const instantAction: Partial<H_InstantAction> = {
      'agentId': this.selectedItem.id as number,
      'agentUuid': this.selectedItem['uuid'],
      'command': this.instantActionCommand,
      'sender': 'helyOS dashboard',
    };
    this.helyosService.methods.instantActions.create(instantAction)
      .then((_) => alert('command sent'));
  }

  getItem(itemId) {
    this.helyosService.methods.agents.get(itemId)
      .then((r: H_Agent) => {
        const message = r['message'];
        if (message) {
          alert(message);
          return;
        }
        console.log(r);
        this.selectedItem = r;
        this.selectedItem.geometry = JSON.stringify(r.geometry, null, 2);
        this.selectedItem.factsheet = JSON.stringify(r.factsheet, null, 2);
        this.selectedItem.wpClearance = JSON.stringify(r.wpClearance, null, 2);
        this.rbmqPassword = '';
        this.saveStateMsg = '';
        const id = r.id;
        const leaderId = typeof id === 'string' ? Number(id) : id;
        this.helyosService.methods.toolsInterconnections.list({
          leaderId: leaderId,
        })
          .then(r => {
            this.interconnections = r;
            return this.interconnections;
          });
      });
  }

  deleteItem(itemId) {
    this.helyosService.methods.agents.delete(itemId)
      .then((_) => {
        this.list();
      });
  }

  validateRabbitMQCredentials(username, password) {
    if (!password) {
      alert('RabbitMQ password is empty');
      return false;
    }
    if (!username || username.indexOf(' ') !== -1) {
      alert('RabbitMQ username is not valid - we recommend to use the agent UUID');
      return false;
    }
    return true;
  }

  validateUniqueIdentifier(uuid) {
    if (!uuid) {
      alert('UUID cannot be blank. UUID V4 is recommended.');
      return false;
    }
    if (uuid.indexOf(' ') !== -1) {
      alert('UUID cannot contain spaces. UUID V4 is recommended.');
      return false;
    }
    return true;
  }

  editItem(item) {
    const patch = {
      ...item,
    };
    delete patch.createdAt;
    delete patch.modifiedAt;
    delete patch.sensors;
    delete patch.agent_poses;
    delete patch.rbmqUsername;
    if (patch.uuid) {
      patch.uuid = patch.uuid.trim();
    }

    try {
      patch.wpClearance = JSON.parse(patch.wpClearance);
    } catch (error) {
      alert('wpClearance is no a valid JSON');
      return;
    }

    try {
      if (patch.orientations) {
        if (!Array.isArray(patch.orientations)) {
          patch.orientations = patch.orientations.split(',');
          patch.orientations = patch.orientations.map(e => parseFloat(e));
        }
      } else {
        patch.orientations = [];
      }
    } catch (error) {
      alert('orientations should be a list. E.g; 1230, 1235, 7879');
      return;
    }

    try {
      patch.geometry = JSON.parse(patch.geometry);
    } catch (error) {
      alert('Geometry is no a valid JSON');
      return;
    }

    try {
      patch.factsheet = JSON.parse(patch.factsheet);
    } catch (error) {
      alert('Factsheet is no a valid JSON');
      return;
    }

    if (!this.validateUniqueIdentifier(patch.uuid)) {
      return;
    }

    if (this.rbmqAccountChange && !this.selectedItem.allowAnonymousCheckin) {
      this.selectedItem.rbmqUsername = this.selectedItem.rbmqUsername.trim();

      if (!this.validateRabbitMQCredentials(this.selectedItem.rbmqUsername, this.rbmqPassword)) {
        return;
      }

    }

    this.helyosService.methods.agents.patch(patch)
      .then((_) => {
        this.updateRabbitMQ();
        this.list();
        this.saveStateMsg = '';
        alert('changes saved');
      });
  }

  onImageSelected(ev) {
    const files = ev.target.files;
    const file = files[0];
    const reader = new FileReader();
    // Convert the file to base64 text
    reader.readAsDataURL(file);
    // on reader upload something...
    reader.onload = () => {
      this.saveStateMsg = 'unsaved changes';
      this.selectedItem.picture = reader.result as string;
    };

  }

  interconnectionList() {
    const id = this.selectedItem.id;
    const leaderId = typeof id === 'string' ? Number(id) : id;
    return this.helyosService.methods.toolsInterconnections.list({
      leaderId: leaderId,
    })
      .then(r => {
        this.interconnections = r;
        return this.interconnections;
      });
  }

  addInterconnection() {
    const followerUUID = prompt("Input the follower UUID");
    if (!followerUUID) {
      return;
    }

    if (followerUUID === this.selectedItem.uuid) {
      alert("follower and leader must be different");
      return;
    }

    this.helyosService.methods.agents.list({
      uuid: followerUUID,
    })
      .then(r => {
        if (!r.length) {
          alert("Agent does not exist!");
          return;
        }

        const id = this.selectedItem.id;
        const leaderId = typeof id === 'string' ? Number(id) : id;
        this.helyosService.methods.toolsInterconnections.create({
          followerId: r[0].id,
          leaderId: leaderId,
        })
          .then((r) => {
            if (r.message) {
              alert(r.message);
            } else {
              this.interconnectionList();
              alert('changes saved');
            }
          }).catch(e => {
            alert(JSON.stringify(e));
          });
      });
  }

  removeAllInterconnections() {
    if (confirm(`Remove all connections to the agents ${this.selectedItem.name}`)) {
      const promisses = this.interconnections.map(e => this.helyosService.methods.toolsInterconnections.delete(e.id));
      const updtPromises = this.interconnections.map(tool => this.helyosService.methods.agents.patch({
        id: tool.followerId,
        rbmqUsername: '',
      }));
      return Promise.all(promisses).then(() => Promise.all(updtPromises)).then(() => this.interconnectionList());
    }
  }

  openDocs() {
    window.open('https://helyos-manual.readthedocs.io/en/latest/2-helyos-configuration/admin-dashboard.html#register-agents-view', '_blank');
  }

}
