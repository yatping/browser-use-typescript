/**def _set_message_context(self) -> str | None:
		if self.tool_calling_method == 'raw':
			if self.settings.message_context:
				self.settings.message_context += f'\n\nAvailable actions: {self.available_actions}'
			else:
				self.settings.message_context = f'Available actions: {self.available_actions}'
		return self.settings.message_context

	def _set_browser_use_version_and_source(self) -> None:
		"""Get the version and source of the browser-use package (git or pip in a nutshell)"""
		try:
			# First check for repository-specific files
			repo_files = ['.git', 'README.md', 'docs', 'examples']
			package_root = Path(__file__).parent.parent.parent

			# If all of these files/dirs exist, it's likely from git
			if all(Path(package_root / file).exists() for file in repo_files):
				try:
					import subprocess

					version = subprocess.check_output(['git', 'describe', '--tags']).decode('utf-8').strip()
				except Exception:
					version = 'unknown'
				source = 'git'
			else:
				# If no repo files found, try getting version from pip
				import pkg_resources

				version = pkg_resources.get_distribution('browser-use').version
				source = 'pip'
		except Exception:
			version = 'unknown'
			source = 'unknown'

		logger.debug(f'Version: {version}, Source: {source}')
		self.version = version
		self.source = source

	def _set_model_names(self) -> None:
		self.chat_model_library = self.llm.__class__.__name__
		self.model_name = 'Unknown'
		if hasattr(self.llm, 'model_name'):
			model = self.llm.model_name  # type: ignore
			self.model_name = model if model is not None else 'Unknown'
		elif hasattr(self.llm, 'model'):
			model = self.llm.model  # type: ignore
			self.model_name = model if model is not None else 'Unknown'

		if self.settings.planner_llm:
			if hasattr(self.settings.planner_llm, 'model_name'):
				self.planner_model_name = self.settings.planner_llm.model_name  # type: ignore
			elif hasattr(self.settings.planner_llm, 'model'):
				self.planner_model_name = self.settings.planner_llm.model  # type: ignore
			else:
				self.planner_model_name = 'Unknown'
		else:
			self.planner_model_name = None

	def _setup_action_models(self) -> None:
		"""Setup dynamic action models from controller's registry"""
		self.ActionModel = self.controller.registry.create_action_model()
		# Create output model with the dynamic actions
		self.AgentOutput = AgentOutput.type_with_custom_actions(self.ActionModel)

		# used to force the done action when max_steps is reached
		self.DoneActionModel = self.controller.registry.create_action_model(include_actions=['done'])
		self.DoneAgentOutput = AgentOutput.type_with_custom_actions(self.DoneActionModel)

	def _set_tool_calling_method(self) -> Optional[ToolCallingMethod]:
		tool_calling_method = self.settings.tool_calling_method
		if tool_calling_method == 'auto':
			if 'deepseek-reasoner' in self.model_name or 'deepseek-r1' in self.model_name:
				return 'raw'
			elif self.chat_model_library == 'ChatGoogleGenerativeAI':
				return None
			elif self.chat_model_library == 'ChatOpenAI':
				return 'function_calling'
			elif self.chat_model_library == 'AzureChatOpenAI':
				return 'function_calling'
			else:
				return None
		else:
			return tool_calling_method */