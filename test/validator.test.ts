import  {test} from "tap";
import express from "express";
import Ajv from "ajv/dist/jtd";
import {Validator} from "../src";

test("Testing the creation of a validator instance works properly", async t => {
  t.type(new Validator({}).ajv, Ajv, "The property 'ajv' should be be an AJV instance");
});
