package bank;

class SavingsAccount extends BankAccount {
    private double interestRate; // 年利率，如 0.03 表示 3%

    public SavingsAccount(String accountNumber, String ownerName, double initialBalance, double interestRate) {
        super(accountNumber, ownerName, initialBalance);
        this.interestRate = interestRate;
    }

    // TODO: 计算一年利息并加到 balance 上
    //       interest = balance * interestRate
    //       balance += interest
    public void applyInterest() {

        double interest = balance * interestRate;
        balance += interest;
    }

    public double getInterestRate() {
        return interestRate;
    }
}
