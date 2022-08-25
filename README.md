# express-jdt-validator-middleware

An express middleware written in the style of and inspired by [express-json-validator-middleware](https://github.com/simonplend/express-json-validator-middleware).
This version is written in Typescript and employs JDT features of AJV to enable parsing of JSON schemas 
into full Typescript objects. You should be familiar with using JTD via AJV schemas
first. For further information  go [the AJV Typescript page](https://ajv.js.org/guide/typescript.html) and the [documentation for JDT schemas for AJV](https://ajv.js.org/json-type-definition.html) for further details about schema 
implementations. Please note that the JTD has not been completely [approved yet](https://datatracker.ietf.org/doc/rfc8927/).

## Installation
Just run `npm install` to install.

## Usage
First you need to import the middleware and AJV:

```typescript
import AJV, {JTDSchemaType} from 'ajv/dist/jtd'
import {Validator, Options} from "express-jdt-validator-middleware";
```

Then you can create a new instance of the middleware in your express app, location
will depend on how you've configured your proejct

```typescript
//Code about using express goes here
const { validator } = new Validator(options);
```

When creating schemas use the Options type to make sure they are equivalent to the type you are parsing, if it
is improperly constructed it will throw a compilation error.
```typescript
interface BareUser{
    firstName: string;
    lastName: string;
}

class User implements BareUser {
    firstName: string;
    lastName: string;

    constructor(_firstName: string, _lastName: string) {
        this.firstName = _firstName;
        this.lastName = _lastName;
    }
}

const schema = {
    body: {
        value: new User("First", "Last"),
        schema: {
            properties: {
                firstName: {type: "string"},
                lastName: {type: "string"}
            }
        } as JTDSchemaType<User>
    }
}

const options: Option<typeof schema> = schema;
```

The formatting is defined as follows
```text
const schema = {
    request property (eg. body/header): {
        value: some value of the target type (can be default), value is not used
        schema: This should match the structure of the object (parameters etc)
        } as JTDSchemaType<type of the value>
    }
}
```

Use for a route would look like the following
```typescript
 app.post("/user", validate(options), (request, response) => {
    response.json({ success: true });
  });
```

## Testing
Run `npm install`
There are several testing modes since [node-tap](https://node-tap.org) times out unless provided flags

| Command                   | Description                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------------|
| test                      | Runs all tests with timeout possible                                                               |
| test-validator            | Runs validation tests (does not run integration.test.ts) with timeout possible                     |
| test-integration          | Runs integration tests (integration.test.ts) with timeout possible                                 |
| test-debugger             | Runs all tests with timeout disabled for debugging usage                                           |
| test-validator-debugger   | Runs validation tests (does not run integration.test.ts) with timeout disabled for debugging usage |
| test-integration-debugger | Runs integration tests (integration.test.ts) with timeout disabled for debugging usage             |