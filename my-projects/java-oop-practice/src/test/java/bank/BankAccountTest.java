package bank;

import static org.junit.Assert.*;
import org.junit.Test;

public class BankAccountTest {

    @Test
    public void testDeposit() throws Exception {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1000.0, 0.03);
        sa.deposit(500.0);
        assertEquals(1500.0, sa.getBalance(), 0.01);
    }

    @Test(expected = InvalidAmountException.class)
    public void testDepositNegative() throws Exception {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1000.0, 0.03);
        sa.deposit(-100.0);
    }

    @Test(expected = InvalidAmountException.class)
    public void testDepositZero() throws Exception {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1000.0, 0.03);
        sa.deposit(0);
    }

    @Test
    public void testWithdraw() throws Exception {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1000.0, 0.03);
        sa.withdraw(300.0);
        assertEquals(700.0, sa.getBalance(), 0.01);
    }

    @Test(expected = InsufficientBalanceException.class)
    public void testWithdrawInsufficient() throws Exception {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1000.0, 0.03);
        sa.withdraw(1500.0);
    }

    @Test(expected = InvalidAmountException.class)
    public void testWithdrawNegative() throws Exception {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1000.0, 0.03);
        sa.withdraw(-50.0);
    }

    @Test
    public void testApplyInterest() {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1000.0, 0.03);
        sa.applyInterest();
        assertEquals(1030.0, sa.getBalance(), 0.01);
    }

    @Test
    public void testCheckingOverdraft() throws Exception {
        CheckingAccount ca = new CheckingAccount("C001", "Bob", 500.0, 1000.0);
        ca.withdraw(1200.0);
        assertEquals(-700.0, ca.getBalance(), 0.01);
    }

    @Test(expected = InsufficientBalanceException.class)
    public void testCheckingOverdraftExceeded() throws Exception {
        CheckingAccount ca = new CheckingAccount("C001", "Bob", 500.0, 1000.0);
        ca.withdraw(2000.0);
    }

    @Test
    public void testToString() {
        SavingsAccount sa = new SavingsAccount("S001", "Alice", 1234.5, 0.03);
        assertEquals("S001 - Alice: ¥1234.50", sa.toString());
    }

    @Test
    public void testPolymorphism() throws Exception {
        BankAccount account = new CheckingAccount("C001", "Charlie", 1000.0, 500.0);
        account.withdraw(1200.0);
        assertEquals(-200.0, account.getBalance(), 0.01);
        assertEquals("C001 - Charlie: ¥-200.00", account.toString());
    }
}
