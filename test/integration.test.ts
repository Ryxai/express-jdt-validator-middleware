import {test} from "tap";
import {JTDSchemaType} from "ajv/dist/jtd";
import axios from "axios";
import express,{ErrorRequestHandler} from "express";
import {Validator, Options} from "../src";
import {AddressInfo} from "net";

test("Validator#Validate schemas both fixed and dynamic", async t => {
  interface BareUser{
    firstName: string;
    lastName: string;
  }
  class User implements BareUser{
    firstName: string;
    lastName: string;
    constructor(_firstName: string, _lastName: string) {
      this.firstName = _firstName;
      this.lastName = _lastName;
    }
  }

  const {validate } = new Validator({});
  const server = express();
  const schema = {
    body: {
      value : new User("First","Last") as BareUser,
      schema: {
        properties: {
          firstName: {type: "string"},
          lastName: {type: "string"}
        }
      } as JTDSchemaType<BareUser>
    }
  };
  const badRequestBody = {
    firsName: "Aleister",
    lastName: "Crowley",
    additional_bypass: "Mischief Maker"
  };
  const goodRequest = {
    firstName: "Kyle",
    lastName: "Katarn"
  }
  const options : Options<typeof schema> = schema;
  server.post("/",validate(options), (_, res) => {
    res.json({success: true});
  });
  server.use(((error,req,res,_) => {res.send(400).json(error)}) as ErrorRequestHandler);
  t.before(() => {
    return new Promise<void>((resolve, _) => {
      const httpServer = server.listen(0, () => {
        t.context.httpServer = httpServer;
        t.context.rootUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
        resolve();
      });
    })
  });
  t.teardown(() => t.context.httpServer.close());
  t.test("Should send an error response when request body is invalid", t => {
    t.plan(3);
    axios.post(t.context.rootUrl, badRequestBody).catch((error) => {
      t.error(error);
      t.equal(error.response.status,400);
    });
  });
  t.test("Should send an error response when request body is invalid", t => {
    t.plan(3);
    axios.post(t.context.rootUrl, goodRequest).then((resp) => {
      t.equal(resp.status,200);
      t.same(resp.data, {success: true});
    });
  });
});
