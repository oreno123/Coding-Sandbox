@echo off
set JUNIT=C:\Users\lenovo\.m2\repository\junit\junit\4.13.2\junit-4.13.2.jar
set HAMCREST=C:\Users\lenovo\.m2\repository\org\hamcrest\hamcrest-core\1.3\hamcrest-core-1.3.jar
set CP=target\classes;target\test-classes;%JUNIT%;%HAMCREST%

echo === Compiling source files ===
javac -encoding UTF-8 -source 11 -target 11 -d target\classes ^
  src\main\java\queue\MyQueue.java ^
  src\main\java\library\Item.java src\main\java\library\Borrowable.java src\main\java\library\Book.java src\main\java\library\ReferenceBook.java src\main\java\library\EBook.java ^
  src\main\java\course\Student.java src\main\java\course\Course.java src\main\java\course\CourseManager.java ^
  src\main\java\shape\Shape.java src\main\java\shape\Circle.java src\main\java\shape\Rectangle.java ^
  src\main\java\employee\Employee.java src\main\java\employee\FullTimeEmployee.java src\main\java\employee\PartTimeEmployee.java src\main\java\employee\Company.java ^
  src\main\java\contact\Contact.java src\main\java\contact\ContactBook.java ^
  src\main\java\bank\InsufficientBalanceException.java src\main\java\bank\InvalidAmountException.java src\main\java\bank\BankAccount.java src\main\java\bank\SavingsAccount.java src\main\java\bank\CheckingAccount.java ^
  src\main\java\store\Category.java src\main\java\store\Discountable.java src\main\java\store\Product.java src\main\java\store\Electronics.java src\main\java\store\Clothing.java src\main\java\store\Food.java src\main\java\store\ShoppingCart.java ^
  src\main\java\task\TaskPriority.java src\main\java\task\TaskStatus.java src\main\java\task\Task.java src\main\java\task\TaskManager.java ^
  src\main\java\expression\Expression.java src\main\java\expression\BinaryExpr.java src\main\java\expression\NumberExpr.java src\main\java\expression\AddExpr.java src\main\java\expression\SubtractExpr.java src\main\java\expression\MultiplyExpr.java ^
  src\main\java\grade\Grade.java src\main\java\grade\CourseGrade.java src\main\java\grade\StudentRecord.java ^
  2>&1
if %ERRORLEVEL% NEQ 0 (
    echo SOURCE COMPILE FAILED
    exit /b 1
)
echo === SOURCE COMPILE OK ===

echo === Compiling test files ===
javac -encoding UTF-8 -source 11 -target 11 -cp "%JUNIT%;target\classes" -d target\test-classes ^
  src\test\java\queue\MyQueueTest.java ^
  src\test\java\library\LibraryTest.java ^
  src\test\java\course\CourseManagerTest.java ^
  src\test\java\shape\ShapeTest.java ^
  src\test\java\employee\EmployeeTest.java ^
  src\test\java\contact\ContactBookTest.java ^
  src\test\java\bank\BankAccountTest.java ^
  src\test\java\store\StoreTest.java ^
  src\test\java\task\TaskTest.java ^
  src\test\java\expression\ExpressionTest.java ^
  src\test\java\grade\GradeTest.java ^
  2>&1
if %ERRORLEVEL% NEQ 0 (
    echo TEST COMPILE FAILED
    exit /b 1
)
echo === TEST COMPILE OK ===

echo === Running tests ===
java -cp "%CP%" org.junit.runner.JUnitCore ^
  queue.MyQueueTest library.LibraryTest course.CourseManagerTest shape.ShapeTest employee.EmployeeTest contact.ContactBookTest ^
  bank.BankAccountTest store.StoreTest task.TaskTest expression.ExpressionTest grade.GradeTest
