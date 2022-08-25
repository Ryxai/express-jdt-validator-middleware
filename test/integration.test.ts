import {test} from "tap";
import express from "express";
import {Validator, Options} from '../src';
import {JTDSchemaType} from "ajv/dist/jtd";
const sget = require("simple-get").concat;

test("Express app route using Validator#Integrate validation of middleware", async t => {
  const app = express();
  app.use(express.json());
  const { validate } = new Validator({}, true);
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
  };
  const badRequest = {
    firstName: "Aleister",
    lastName: "Crowley",
    additional_bypass: "Mischief Maker"
  };
  const goodRequest : BareUser = {
    firstName: "Kyle",
    lastName: "Katarn"
  }
  const options : Options<typeof schema> = schema;


  app.post("/user", validate(options), (request, response) => {
    response.status(200).json({ success: true });
  });

  app.use(function errorHandlerMiddleware(error: any, request: any , response: any, next: any) {
    response.status(400).json(error);
  });

  t.before(() => {
    return new Promise<void>((resolve, _) => {
      const httpServer = app.listen(4000, () => {
        t.context.httpServer = httpServer;
        //@ts-ignore
        t.context.rootUrl = `http://127.0.0.1:${httpServer.address().port}`;
        resolve();
      });
    });
  });

  t.teardown(() => {t.context.httpServer.close();} );

  t.test("should send an error response when request body is invalid", t => {
    t.plan(3);

    sget({
      url: t.context.rootUrl + "/user",
      method: "POST",
      body: badRequest,
      json: true
    }, (error: any, response: any, body: any) => {
      t.error(error);
      t.equal(response.statusCode, 400);
      t.match(body, { name: "JTDSchemaParsingError" });
    });
  });

  t.test("should send a success response when request body is valid", t => {
    t.plan(3)
    sget({
      url: t.context.rootUrl + "/user",
      method: "POST",
      body: goodRequest,
      json: true
    }, (error: any, response: any, body: any) => {
      t.error(error);
      t.equal(response.statusCode, 200);
      t.same(body, { success: true });
    });
  });
});
