import { AccountsModule } from './accounts.module';

describe('YardsModule', () => {
  let accountsModule: AccountsModule;

  beforeEach(() => {
    accountsModule = new AccountsModule();
  });

  it('should create an instance', () => {
    expect(accountsModule).toBeTruthy();
  });
});
