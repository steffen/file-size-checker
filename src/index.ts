import { Application } from 'probot'

export = (app: Application) => {
  app.on(['pull_request.opened', 'pull_request.edited', 'pull_request.synchronize'], async context => {
    const { owner, repo } = context.repo()
    const { base, head } = context.payload.pull_request

    const compareCommitsResult = await context.github.repos.compareCommits(context.repo({ base: base.sha, head: head.sha }))
    const changedFiles = compareCommitsResult.data.files

    let blobQueries = ''

    changedFiles.forEach((file: any, index: number) => {
      blobQueries += `blob${index}: object(expression: "${head.sha}:${file.filename}") { ... on Blob { byteSize } }`
    });

    const blobQuery = `
      query($owner: String!, $repo: String!) { 
        organization(login: $owner) {
          repository(name: $repo) {
            ${blobQueries}
          }
        }
      }
    `

    const blobQueryResult = await context.github.query(blobQuery, { owner, repo }) as any

    const byteSizes: number[] = []
    const repositoryResult = blobQueryResult.organization.repository
    
    changedFiles.forEach((file: any, index: number) => {
      byteSizes.push(repositoryResult[`blob${index}`].byteSize)
    })

    let state: 'success' | 'failure';
    let description;

    if (byteSizes.some((byteSize) => byteSize > 10)) {
      state = 'failure' as 'failure'
      description = 'At least one file exceeds the file size limit of 10 bytes'
    } else {
      state = 'success' as 'success'
      description = 'No files exceed file size limit of 10 bytes'
    }

    app.log(state);

    const reposCreateStatusParams = {
      owner,
      repo,
      sha: head.sha,
      state,
      target_url: 'https://github.com/steffen/file-size-checker',
      description,
      context: 'File Size Checker'
    }

    await context.github.repos.createStatus(reposCreateStatusParams)
  })
}
