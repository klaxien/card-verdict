import {afterAll, afterEach, beforeAll} from 'vitest'
import {server} from "~/test/mocks/server";

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
