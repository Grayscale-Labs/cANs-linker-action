"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const opened_1 = __importDefault(require("./opened"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        (0, core_1.debug)("Running cANs-linker-action");
        if (github_1.context.eventName !== "pull_request") {
            (0, core_1.setFailed)("This action only works with `pull_request` events");
            return;
        }
        const payload = github_1.context.payload;
        switch (payload.action) {
            case "opened":
                (0, core_1.debug)("Running `opened` task");
                return (0, opened_1.default)();
            default:
                (0, core_1.setFailed)("This action only works with the `opened` action for `pull_request` events");
                return;
        }
    });
}
run();
