# Contributing Guidelines

Thank you for considering contributing to the helyOS Framework! We appreciate your interest in helping us improve our project. To ensure a smooth collaboration, please follow these guidelines when contributing.

## Table of Contents
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Asking Questions](#asking-questions)

## Getting Started

helyOS framework projects use pull requests to discuss, collaborate on and accept code contributions.
Pull requests is the primary place of discussing code changes.

## How to Contribute

1. Fork the repository and clone it to your local machine.
2. Create a branch with a descriptive name in the relevant repositories.
3. Make your changes, run tests, ensure correct code formatting, commit with a descriptive message.
4. Submit pull requests with an explanation what has been changed and **why**.
5. Be patient. We will get to your pull request eventually.

## Running Tests

... 


## Code Style
In this project, we adhere to the following code style guidelines for CommonJS:

### File Structure

- Organize your code into modules and separate them into different files.
- Use the CommonJS module system to import and export modules.

### Naming Conventions

- Use descriptive and meaningful names for variables, functions, and modules.
- Use camel case for variable and function names (e.g., `myVariable`, `myFunction`).
- Use Pascal case for class names (e.g., `MyClass`).

### Formatting
- Use single quotes for strings.
- Use semicolons to end statements.

### Comments
- Use comments to explain complex logic or to provide additional context.
- Use JSDoc comments to document functions, parameters, and return types.
- With the exception of JSDocs, utilize double slashes (//) for commenting purposes throughout the codebase.

### Error Handling

- Use try-catch blocks to handle exceptions.
- Handle errors gracefully and provide meaningful error messages.

### Code Organization

- Keep your code modular and organized.
- Separate concerns and avoid writing large monolithic functions or classes.
- Create classes to represent entities, with their methods and attributes; a class is not a collection of functions.

### Best Practices

- High-level modules should avoid direct dependencies on low-level modules, promoting interaction through abstractions instead.
- Service modules should not depend of each other.

Remember to adhere to these code style guidelines to maintain consistency and readability throughout the project.


## Asking Questions

If you have any question, please write to our [Discussion](https://github.com/helyOSFramework/helyos_core/discussions/) forum.
