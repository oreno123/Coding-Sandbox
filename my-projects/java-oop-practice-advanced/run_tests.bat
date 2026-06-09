@echo off
set JUNIT=C:\Users\lenovo\.m2\repository\junit\junit\4.13.2\junit-4.13.2.jar
set HAMCREST=C:\Users\lenovo\.m2\repository\org\hamcrest\hamcrest-core\1.3\hamcrest-core-1.3.jar
set CP=target\classes;target\test-classes;%JUNIT%;%HAMCREST%

echo === Compiling source files ===
javac -encoding UTF-8 -source 11 -target 11 -d target\classes ^
  src\main\java\genericlist\SimpleLinkedList.java ^
  src\main\java\filesystem\FSComponent.java src\main\java\filesystem\File.java src\main\java\filesystem\Directory.java ^
  src\main\java\eventsystem\Event.java src\main\java\eventsystem\EventListener.java src\main\java\eventsystem\EventEmitter.java ^
  src\main\java\builder\Student.java ^
  2>&1
if %ERRORLEVEL% NEQ 0 (
    echo SOURCE COMPILE FAILED
    exit /b 1
)
echo === SOURCE COMPILE OK ===

echo === Compiling test files ===
javac -encoding UTF-8 -source 11 -target 11 -cp "%JUNIT%;target\classes" -d target\test-classes ^
  src\test\java\genericlist\SimpleLinkedListTest.java ^
  src\test\java\filesystem\FilesystemTest.java ^
  src\test\java\eventsystem\EventSystemTest.java ^
  src\test\java\builder\StudentBuilderTest.java ^
  2>&1
if %ERRORLEVEL% NEQ 0 (
    echo TEST COMPILE FAILED
    exit /b 1
)
echo === TEST COMPILE OK ===

echo === Running tests ===
java -cp "%CP%" org.junit.runner.JUnitCore ^
  genericlist.SimpleLinkedListTest ^
  filesystem.FilesystemTest ^
  eventsystem.EventSystemTest ^
  builder.StudentBuilderTest
