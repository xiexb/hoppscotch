import { Environment, HoppRESTRequest } from "@hoppscotch/data";
import { EffectiveHoppRESTRequest } from "../../../interfaces/request";
import { HoppCLIError } from "../../../types/errors";
import { getEffectiveRESTRequest } from "../../../utils/pre-request";

import "@relmify/jest-fp-ts";

const DEFAULT_ENV = <Environment>{
  name: "name",
  variables: [
    {
      key: "HEADER",
      value: "parsed_header",
    },
    { key: "PARAM", value: "parsed_param" },
    { key: "TOKEN", value: "parsed_token" },
    { key: "BODY_PROP", value: "parsed_body_prop" },
    { key: "ENDPOINT", value: "https://parsed-endpoint.com" },
  ],
};

const DEFAULT_REQUEST = <HoppRESTRequest>{
  v: "18",
  name: "name",
  method: "GET",
  endpoint: "https://example.com",
  params: [],
  pathParams: [],
  headers: [],
  preRequestScript: "",
  testScript: "",
  auth: {
    authActive: false,
    authType: "none",
  },
  body: {
    contentType: null,
    body: null,
  },
  requestVariables: [],
  responses: {},
};

describe("getEffectiveRESTRequest", () => {
  let SAMPLE_REQUEST = Object.assign({}, DEFAULT_REQUEST);

  beforeEach(() => {
    SAMPLE_REQUEST = Object.assign({}, DEFAULT_REQUEST);
  });

  test("Endpoint, headers and params with unavailable ENV.", () => {
    SAMPLE_REQUEST.headers = [
      {
        key: "HEADER",
        value: "<<UNKNOWN>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.params = [
      {
        key: "PARAM",
        value: "<<UNKNOWN>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.endpoint = "<<UNKNOWN>>";

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalHeaders: [{ active: true, key: "HEADER", value: "" }],
      effectiveFinalParams: [{ active: true, key: "PARAM", value: "" }],
      effectiveFinalURL: "",
    });
  });

  test("Auth with unavailable ENV.", () => {
    SAMPLE_REQUEST.auth = {
      authActive: true,
      authType: "bearer",
      token: "<<UNKNOWN>>",
    };

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalHeaders: [
        { active: true, key: "Authorization", value: "Bearer " },
      ],
    });
  });

  test("Body with unavailable ENV.", () => {
    SAMPLE_REQUEST.body = {
      contentType: "text/plain",
      body: "<<UNKNOWN>>",
    };

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualLeft(<HoppCLIError>{
      code: "PARSING_ERROR",
    });
  });

  test("Request meta-data with available ENVs.", () => {
    SAMPLE_REQUEST.headers = [
      {
        key: "HEADER",
        value: "<<HEADER>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.params = [
      {
        key: "PARAM",
        value: "<<PARAM>>",
        active: true,
      },
    ];
    SAMPLE_REQUEST.endpoint = "<<ENDPOINT>>";
    SAMPLE_REQUEST.auth = {
      authActive: true,
      authType: "bearer",
      token: "<<TOKEN>>",
    };
    SAMPLE_REQUEST.body = {
      contentType: "text/plain",
      body: "<<BODY_PROP>>",
    };

    const vars = DEFAULT_ENV.variables;

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalHeaders: [
        { active: true, key: "HEADER", value: vars[0].value },
        {
          active: true,
          key: "Authorization",
          value: `Bearer ${vars[2].value}`,
        },
        { active: true, key: "content-type", value: "text/plain" },
      ],
      effectiveFinalParams: [
        { active: true, key: "PARAM", value: vars[1].value },
      ],
      effectiveFinalURL: vars[4].value,
      effectiveFinalBody: vars[3].value,
      effectiveFinalPathParams: [],
    });
  });

  test("PathParams are resolved in the endpoint URL via {var} syntax.", () => {
    SAMPLE_REQUEST.endpoint = "https://example.com/{USER_ID}/posts";
    SAMPLE_REQUEST.pathParams = [
      { key: "USER_ID", value: "42", active: true, description: "" },
    ];

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalURL: "https://example.com/42/posts",
      effectiveFinalPathParams: [
        { key: "USER_ID", value: "42", active: true, description: "" },
      ],
    });
  });

  test("<<var>> resolves from env vars even when a same-named pathParam exists.", () => {
    // <<USER_ID>> should resolve from env vars (value "99"), NOT pathParams (value "42").
    // {USER_ID} is the correct syntax for path param substitution.
    SAMPLE_REQUEST.endpoint = "https://example.com/{USER_ID}/posts";
    SAMPLE_REQUEST.pathParams = [
      { key: "USER_ID", value: "42", active: true, description: "" },
    ];

    const ENV_WITH_SAME_KEY = <Environment>{
      name: "name",
      variables: [
        { key: "USER_ID", value: "99" },
      ],
    };

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, ENV_WITH_SAME_KEY)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalURL: "https://example.com/42/posts",
      effectiveFinalPathParams: [
        { key: "USER_ID", value: "42", active: true, description: "" },
      ],
    });
  });

  test("Inactive pathParams are ignored.", () => {
    SAMPLE_REQUEST.endpoint = "https://example.com/{USER_ID}/posts";
    SAMPLE_REQUEST.pathParams = [
      { key: "USER_ID", value: "42", active: false, description: "" },
    ];

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, DEFAULT_ENV)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalURL: "https://example.com/{USER_ID}/posts",
      effectiveFinalPathParams: [],
    });
  });

  test("<<var>> in body resolves from env vars, not pathParams.", () => {
    // When a pathParam and env var share the same key, <<var>> in the body
    // must resolve to the env var value, not the pathParam value.
    SAMPLE_REQUEST.endpoint = "https://example.com/{USER_ID}/posts";
    SAMPLE_REQUEST.pathParams = [
      { key: "USER_ID", value: "42", active: true, description: "" },
    ];
    SAMPLE_REQUEST.body = {
      contentType: "application/json",
      body: '{"userId": "<<USER_ID>>"}',
    };

    const ENV_WITH_SAME_KEY = <Environment>{
      name: "name",
      variables: [
        { key: "USER_ID", value: "99" },
      ],
    };

    expect(
      getEffectiveRESTRequest(SAMPLE_REQUEST, ENV_WITH_SAME_KEY)
    ).toSubsetEqualRight(<EffectiveHoppRESTRequest>{
      effectiveFinalURL: "https://example.com/42/posts",
      effectiveFinalBody: '{"userId": "99"}',
      effectiveFinalPathParams: [
        { key: "USER_ID", value: "42", active: true, description: "" },
      ],
    });
  });
});
