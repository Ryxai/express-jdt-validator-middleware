import {test} from "tap";
import Ajv,{JTDSchemaType} from "ajv/dist/jtd";
import express from "express";
import {Validator, ParsingError, Options} from "../src";
import {Request, Response} from "express";

test("Validator#Validate middleware with a schema object", async t => {
  interface EncapsulatedString {
    name: string;
  }
  class EncapString implements EncapsulatedString {
    name: string;
    constructor(_name: string) {
      this.name = _name;
    }
  }
  const schema = ({
    body: {
      value : new EncapString("inmaterial") as EncapsulatedString,
      schema: {
        properties: {
          name: {type: "string"}
        }
      } as JTDSchemaType<EncapsulatedString>
    }
  });
  const failingSchema = ({
    frisbee: {
      type : new EncapString("inmaterial") as EncapsulatedString,
      schema: {
        properties: {
          name: {type: "string"}
        }
      } as JTDSchemaType<EncapsulatedString>
    }
  });
  const failedSchemaDueToProperty = ({
    frisbee: {
      value : new EncapString("inmaterial") as EncapsulatedString,
      schema: {
        properties: {
          name: {type: "string"}
        }
      } as JTDSchemaType<EncapsulatedString>
    }
  });

  const successfulSchemaOptions : Options<typeof schema> = schema;
  //Should fail to compile if uncommented
  //const failingSchemaOptions : Options<typeof failingSchema> = failingSchema;
  const failsPropertyTestSchemaOptions : Options<typeof failedSchemaDueToProperty> = failedSchemaDueToProperty;
  const middleware = new Validator().validate(successfulSchemaOptions);
  t.test("Should fail to build a parser throwing an Error", t => {
    t.plan(1);
    t.throws((new Validator()).validate(failsPropertyTestSchemaOptions), Error);
  });
  t.test("Should call a ParsingError when there are ParsingErrors", t => {
    t.plan(1);
    middleware({body: {}, parsed: {}} as Request, {} as Response, (error) => {t.type(error, ParsingError);
    });
  });
  t.test("Should call next with no error swhen the input is parsed successfully", t => {
    t.plan(1);
    middleware({body: {name: "hello"}, parsed: {}} as Request, {} as Response, (error) => {
      t.equal(error, undefined)});
  });
  t.test("Should successfully parse an input and add it to the parsed object when called", t => {
    t.plan(1);
    const req : Request = {body: {name: "hello"}, parsed: {}} as Request;
    middleware(req as Request, {} as Response, () => {
      t.has(req,"parsed");
      t.has(req.parsed,"name");
      t.equal(req.parsed!.name,req.body.name);
    });
  });
});

test("Validator# Validate middleware configured with a dynamic schema function", async t => {
interface EncapsulatedString {
    name: string;
  }
  class EncapString implements EncapsulatedString {
    name: string;
    constructor(_name: string) {
      this.name = _name;
    }
  }
  const schema = ({
    body: {
      value : new EncapString("inmaterial") as EncapsulatedString,
      schema: () => {return {
        properties: {
          name: {type: "string"}
        }
      } as JTDSchemaType<EncapsulatedString>}
    }
  });
  const failingSchema = ({
    frisbee: {
      type : new EncapString("inmaterial") as EncapsulatedString,
      schema: () => {return {
        properties: {
          name: {type: "string"}
        }
      } as JTDSchemaType<EncapsulatedString>}
    }
  });
  const failedSchemaDueToProperty = ({
    frisbee: {
      value : new EncapString("inmaterial") as EncapsulatedString,
      schema: () => {return {
        properties: {
          name: {type: "string"}
        }
      } as JTDSchemaType<EncapsulatedString>}
    }
  });
  const successfulSchemaOptions : Options<typeof schema> = schema;
  //The following should fail to compule
  //const failingSchemaOptions : Options<typeof failingSchema> = schema
  const failsPropertyTestSchemaOptions : Options<typeof failedSchemaDueToProperty> = failedSchemaDueToProperty;
  const middleware = new Validator().validate(successfulSchemaOptions);
  t.test("Should fail to build a parser throwing an Error", t => {
    t.plan(1);
    t.throws((new Validator()).validate(failsPropertyTestSchemaOptions), Error);
  });
  t.test("Should call a ParsingError when there are ParsingErrors", t => {
    t.plan(1);
    middleware({body: {}, parsed: {}} as Request, {} as Response, (error) => {t.type(error, ParsingError);
    });
  });
  t.test("Should call next with no error swhen the input is parsed successfully", t => {
    t.plan(1);
    middleware({body: {name: "hello"}, parsed: {}} as Request, {} as Response, (error) => {
      t.equal(error, undefined)});
  });
  t.test("Should successfully parse an input and add it to the parsed object when called", t => {
    t.plan(1);
    const req : Request = {body: {name: "hello"}, parsed: {}} as Request;
    middleware(req as Request, {} as Response, () => {
      t.has(req,"parsed");
      t.has(req.parsed,"name");
      t.equal(req.parsed!.name,req.body.name);
    });
  });
});
