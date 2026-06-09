package bank;

abstract class BankAccount {
    protected String accountNumber;
    protected String ownerName;
    protected double balance;

    public BankAccount(String accountNumber, String ownerName, double initialBalance) {
        this.accountNumber = accountNumber;
        this.ownerName = ownerName;
        this.balance = initialBalance;
    }

    // TODO: 存款，金额 <= 0 时抛出 InvalidAmountException("Amount must be positive")
    //       否则 balance += amount
    public void deposit(double amount) throws InvalidAmountException {
        if (amount <= 0) {
            throw new InvalidAmountException("Amount must be positive");
        } else {
            balance += amount;
        }

    }

    // TODO: 取款
    //       金额 <= 0 抛出 InvalidAmountException("Amount must be positive")
    //       金额 > getAvailableBalance() 抛出 InsufficientBalanceException("Insufficient balance")
    //       否则 balance -= amount
    public void withdraw(double amount) throws InsufficientBalanceException, InvalidAmountException {
        if (amount <= 0) {
            throw new InvalidAmountException("Amount must be positive");
        } else if (amount > getAvailableBalance()) {
            throw new InsufficientBalanceException("Insufficient balance");
        } else {
            balance -= amount;
        }

    }

    // 子类可重写，透支额度默认为 0
    protected double getOverdraftLimit() {
        return 0;
    }

    // 可用余额 = balance + overdraftLimit
    protected double getAvailableBalance() {
        return balance + getOverdraftLimit();
    }

    public double getBalance() {
        return balance;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public String getOwnerName() {
        return ownerName;
    }

    // TODO: 返回 "[accountNumber] - [ownerName]: ¥[balance保留2位小数]"
    // 提示: String.format("%s - %s: ¥%.2f", accountNumber, ownerName, balance)
    @Override
    public String toString() {
        return String.format("%s - %s: ¥%.2f", accountNumber, ownerName, balance);
    }
}
