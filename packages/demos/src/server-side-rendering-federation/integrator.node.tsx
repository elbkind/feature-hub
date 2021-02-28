import {
  AsyncSsrManagerV1,
  defineAsyncSsrManager,
} from '@feature-hub/async-ssr-manager';
import {createFeatureHub} from '@feature-hub/core';
import {
  WebpackInitSharing,
  WebpackShareScopes,
  loadFederationModuleSsrFactory,
} from '@feature-hub/module-loader-federation-cjs';
import {
  Css,
  FeatureHubContextProvider,
  FeatureHubContextProviderValue,
} from '@feature-hub/react';
import {
  SerializedStateManagerV1,
  serializedStateManagerDefinition,
} from '@feature-hub/serialized-state-manager';
import * as React from 'react';
import * as ReactDOM from 'react-dom/server';
import {AppRendererOptions, AppRendererResult} from '../app-renderer';
import {App} from './app';

declare const __webpack_init_sharing__: WebpackInitSharing;
declare const __webpack_share_scopes__: WebpackShareScopes;

export default async function renderApp({
  port,
}: AppRendererOptions): Promise<AppRendererResult> {
  const asyncSsrManagerDefinition = defineAsyncSsrManager();

  const moduleLoader = loadFederationModuleSsrFactory(
    __webpack_init_sharing__,
    __webpack_share_scopes__
  );

  const {featureAppManager, featureServices} = createFeatureHub(
    'test:integrator',
    {
      moduleLoader,
      providedExternals: {},
      featureServiceDefinitions: [
        asyncSsrManagerDefinition,
        serializedStateManagerDefinition,
      ],
      featureServiceDependencies: {
        [asyncSsrManagerDefinition.id]: '^1.0.0',
        [serializedStateManagerDefinition.id]: '^1.0.0',
      },
    }
  );

  const asyncSsrManager = featureServices[
    asyncSsrManagerDefinition.id
  ] as AsyncSsrManagerV1;

  const urlsForHydration = new Set<string>();
  const stylesheetsForSsr = new Map<string, Css>();

  const featureHubContextValue: FeatureHubContextProviderValue = {
    featureAppManager,
    asyncSsrManager,

    addUrlForHydration: (url) => urlsForHydration.add(url),

    addStylesheetsForSsr: (stylesheets) => {
      for (const stylesheet of stylesheets) {
        stylesheetsForSsr.set(stylesheet.href, stylesheet);
      }
    },
  };

  const html = await asyncSsrManager.renderUntilCompleted(() =>
    ReactDOM.renderToString(
      <FeatureHubContextProvider value={featureHubContextValue}>
        <App port={port} />
      </FeatureHubContextProvider>
    )
  );

  const serializedStateManager = featureServices[
    serializedStateManagerDefinition.id
  ] as SerializedStateManagerV1;

  const serializedStates = serializedStateManager.serializeStates();

  return {html, serializedStates, stylesheetsForSsr, urlsForHydration};
}
