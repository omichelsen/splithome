import omichelsen from 'eslint-config-omichelsen'

export default [
	{
		ignores: ['dist/**'],
	},
	...omichelsen,
	{
		rules: {
			// Fetch-on-mount is the intended pattern here (App fetches expenses
			// once on mount); same override as Regex's eslint.config.mjs.
			'react-hooks/set-state-in-effect': 0,
		},
	},
]
