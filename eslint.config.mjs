import { sharedConfigs } from '@nodescript/eslint-config';

export default [
    {
        ignores: ['build/**'],
    },
    ...sharedConfigs,
];
