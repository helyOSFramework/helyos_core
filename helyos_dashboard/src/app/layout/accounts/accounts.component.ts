import { Component, OnInit } from '@angular/core';
import { H_UserAccount } from 'helyosjs-sdk/dist/helyos.models';
import { HelyosService } from '../../services/helyos.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
})
export class AccountsComponent implements OnInit {
  public items: H_UserAccount[];
  public selectedItem: H_UserAccount;
  public USER_ROLE = [
    'administration',
    'application',
    'visualization',
  ];
  public password: string;
  public confirmedPassword: string;
  public encryptedPassword: string;
  public accountToken: string;
  public copyLabel: string;
  public setPassFlag: boolean;

  constructor(private helyosService: HelyosService, private modalService: NgbModal) {

  }

  ngOnInit() {
    this.list();
  }

  list() {
    return this.helyosService.methods.userAccounts.list({})
      .then(r => this.items = r);
  }

  create() {
    const newItem = {
      username: 'unnamed',
      passwordHash: " ",
    };
    this.helyosService.methods.userAccounts.create(newItem)
      .then(r => {
        console.log(r);
        this.list().then(() => this.getItem(r.id));

      });
  }

  getItem(itemId) {
    this.helyosService.methods.userAccounts.get(itemId)
      .then((r: H_UserAccount) => {
        this.selectedItem = r;
        if (!r.metadata) { r.metadata = {}; }
        this.selectedItem.metadata = JSON.stringify(r.metadata, null, 2);
      });
  }

  deleteItem(itemId) {
    this.helyosService.methods.userAccounts.delete(itemId)
      .then((_) => {
        this.list();
      });
  }

  editItem(item) {
    const patch: Partial<H_UserAccount> = {
      ...item,
    };
    delete patch.createdAt;
    delete patch.modifiedAt;
    delete patch.passwordHash;
    delete patch.userId;

    try {
      patch.metadata = JSON.parse(patch.metadata);
    } catch (error) {
      alert('Settings is not a valid JSON');
      return 0;
    }

    if (typeof patch.userRole !== 'number') {
      patch.userRole = parseInt(patch.userRole);
    }

    this.helyosService.methods.userAccounts.patch(patch)
      .then((_) => {
        this.list();
      });
  }

  getToken(content) {
    this.copyLabel = ' Copy ';
    this.helyosService.methods.adminGetUserAuthToken(this.selectedItem.username)
      .then(r => {
        this.accountToken = `Bearer ${r.jwtToken}`;
        const _ = this.modalService.open(content, {
          size: 'lg',
          centered: true,
          backdrop: false,
        });
      });

  }

  copyText() {
    navigator.clipboard.writeText(this.accountToken)
      .then(() => this.copyLabel = String.fromCharCode(10003) + ' Copied');

  }

  setPassword() {
    if (this.password !== this.confirmedPassword) {
      alert('Password does not match');
      return;
    }
    this.helyosService.methods.adminChangePassword(this.selectedItem.username, this.password)
      .then(() => {
        this.password = '';
        this.confirmedPassword = '';
        this.setPassFlag = false;
      });

  }

  openDocs() {
    window.open('https://helyos-manual.readthedocs.io/en/latest/3-helyos-and-client-apps/application-accounts.html', '_blank');
  }

}
