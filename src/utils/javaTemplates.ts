/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface JavaTemplate {
  id: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'OOP';
  icon: string;
  code: string;
}

export const JAVA_TEMPLATES: JavaTemplate[] = [
  {
    id: 'hello-world',
    title: 'Hello World',
    description: 'The standard entry point to learning Java programming.',
    difficulty: 'Beginner',
    icon: 'Terminal',
    code: `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, Guest!");
        System.out.println("Welcome to the Mobile Java Compiler!");
        System.out.println("Everything runs completely offline.");
        
        int a = 12;
        int b = 30;
        int sum = a + b;
        System.out.println("The sum of a and b is: " + sum);
    }
}`
  },
  {
    id: 'user-input',
    title: 'Interactive Math Calculator',
    description: 'Demonstrates Scanner input and conditional arithmetic controls.',
    difficulty: 'Beginner',
    icon: 'Calculator',
    code: `import java.util.Scanner;

public class BasicCalculator {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        
        System.out.println("=== Offline Java Calculator ===");
        System.out.print("Enter your first integer number: ");
        int num1 = sc.nextInt();
        
        System.out.print("Enter your second integer number: ");
        int num2 = sc.nextInt();
        
        System.out.println("\\nChoose Operations:");
        System.out.println("1. Addition (+)");
        System.out.println("2. Subtraction (-)");
        System.out.println("3. Multiplication (*)");
        System.out.println("4. Division (/)");
        System.out.print("Select choice (1-4): ");
        int choice = sc.nextInt();
        
        if (choice == 1) {
            System.out.println("Result: " + num1 + " + " + num2 + " = " + (num1 + num2));
        } else if (choice == 2) {
            System.out.println("Result: " + num1 + " - " + num2 + " = " + (num1 - num2));
        } else if (choice == 3) {
            System.out.println("Result: " + num1 + " * " + num2 + " = " + (num1 * num2));
        } else if (choice == 4) {
            if (num2 == 0) {
                System.out.println("Error: Logical division by zero is prohibited!");
            } else {
                System.out.println("Result: " + num1 + " / " + num2 + " = " + (num1 / num2));
            }
        } else {
            System.out.println("Invalid operation selected!");
        }
    }
}`
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci Sequence Generator',
    description: 'Computes Fibonacci sequence up to a dynamic range using iteration.',
    difficulty: 'Intermediate',
    icon: 'Layers',
    code: `import java.util.Scanner;

public class Fibonacci {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        
        System.out.print("How many Fibonacci sequence terms to print? ");
        int terms = sc.nextInt();
        
        if (terms <= 0) {
            System.out.println("Please select a number greater than 0");
            return;
        }
        
        System.out.println("Generating " + terms + " terms of Fibonacci:");
        int term1 = 0, term2 = 1;
        
        for (int i = 1; i <= terms; ++i) {
            System.out.print(term1);
            if (i < terms) {
                System.out.print(", ");
            }
            
            // Compute the next term
            int nextTerm = term1 + term2;
            term1 = term2;
            term2 = nextTerm;
        }
        System.out.println("\\nDone!");
    }
}`
  },
  {
    id: 'oop-car',
    title: 'Object-Oriented Cars',
    description: 'Initializes customized class fields, parameterized constructors, and object logic.',
    difficulty: 'OOP',
    icon: 'Sparkles',
    code: `public class MainClass {
    public static void main(String[] args) {
        System.out.println("Creating new Vehicle instances...");
        
        // Instantiate using classic constructor
        Car tesla = new Car("Model S", 2025, "Electric Red");
        Car mustang = new Car("Mustang GT", 2023, "V8 Midnight Black");
        
        // Output car states
        tesla.displayDetails();
        tesla.startEngine();
        
        System.out.println("");
        
        mustang.displayDetails();
        mustang.startEngine();
    }
}

class Car {
    String model;
    int year;
    String color;
    
    // Parameterized Constructor
    Car(String m, int y, String c) {
        this.model = m;
        this.year = y;
        this.color = c;
    }
    
    void displayDetails() {
        System.out.println("Car Description: " + year + " " + model + " [" + color + "]");
    }
    
    void startEngine() {
        System.out.println("The " + model + "'s engine roared to life! Vroom!");
    }
}`
  },
  {
    id: 'bubble-sort',
    title: 'Array Bubble Sort',
    description: 'Fills, sorts, and prints lists using standard bubble sort pass algorithm.',
    difficulty: 'Intermediate',
    icon: 'Shuffle',
    code: `public class BubbleSort {
    public static void main(String[] args) {
        int[] numList = { 64, 34, 25, 12, 22, 11, 90 };
        int len = numList.length;
        
        System.out.print("Original Array: ");
        printArray(numList);
        
        // Perform Bubble Sort algorithm
        for (int i = 0; i < len - 1; i++) {
            for (int j = 0; j < len - i - 1; j++) {
                if (numList[j] > numList[j + 1]) {
                    // Swap values
                    int temp = numList[j];
                    numList[j] = numList[j + 1];
                    numList[j + 1] = temp;
                }
            }
        }
        
        System.out.print("Sorted Array:   ");
        printArray(numList);
    }
    
    public static void printArray(int[] arr) {
        int size = arr.length;
        for (int i = 0; i < size; ++i) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }
}`
  }
];
