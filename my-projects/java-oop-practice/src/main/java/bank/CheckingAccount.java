package bank;

class CheckingAccount extends BankAccount {
    private double overdraftLimit;

    public CheckingAccount(String accountNumber, String ownerName, double initialBalance, double overdraftLimit) {
        super(accountNumber, ownerName, initialBalance);
        this.overdraftLimit = overdraftLimit;
    }

    // TODO: 重写 getOverdraftLimit，返回 overdraftLimit
    @Override
    protected double getOverdraftLimit() {
        return overdraftLimit; // 修改这行
    }

    public double getOverdraftLimitPublic() {
        return overdraftLimit;
    }
}
